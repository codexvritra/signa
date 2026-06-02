/**
 * The open agent capability marketplace.
 *
 * Any developer registers a capability with ONE wallet-signed call — no
 * signup, no API key. The capability becomes discoverable in the directory,
 * callable by any agent and by the brain, and optionally priced in USDC via
 * x402. Registration is an EIP-191 envelope re-verified server-side; the
 * provider wallet is the only credential.
 *
 * Security: registered endpoints are proxied through an SSRF-guarded fetch
 * (https only, private/loopback hosts blocked, no redirects, hard timeout +
 * size cap). Writes go through the service-role client so anon keys cannot
 * inject capabilities; the table is RLS-protected (public read only).
 */
import { supabase, serverClient } from "@/lib/supabase";

export type RegisteredCapability = {
  name: string;
  provider_address: string;
  endpoint: string;
  method: string;
  description: string;
  input_hint: string | null;
  price_usdc: number;
  pay_to: string | null;
  ts: number;
  calls: number;
};

/** Canonical preimage a provider signs to register (bit-for-bit on both sides). */
export function registerPreimage(a: {
  ts: number; name: string; provider: string; endpoint: string; method: string; price: number | string;
}): string {
  return [
    "SIGNA capability register v1",
    `ts:${a.ts}`,
    `name:${a.name}`,
    `provider:${a.provider.toLowerCase()}`,
    `endpoint:${a.endpoint}`,
    `method:${a.method.toUpperCase()}`,
    `price:${a.price}`,
  ].join("\n");
}

const NAME_RE = /^[a-z0-9]([a-z0-9._-]{1,38}[a-z0-9])$/i;

/** Validate a capability name (namespaced, e.g. "myteam.summarize"). */
export function validName(n: string): boolean {
  return NAME_RE.test(n) && !["bankr.resolve", "bankr.launches", "root.market", "root.feargreed"].includes(n.toLowerCase());
}

/** SSRF guard — only allow https public hosts; block private/loopback/metadata. */
export function isSafeEndpoint(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h === "metadata.google.internal") return false;
  // raw IPv4 literal → block private + loopback + link-local ranges
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return false;
  }
  if (h.includes(":")) return false; // raw IPv6 literal — block
  if (!h.includes(".")) return false; // require a real domain
  return true;
}

/** Proxy a call to a registered capability endpoint, guarded. Returns parsed output. */
export async function callRegistered(cap: RegisteredCapability, arg: string): Promise<unknown> {
  if (!isSafeEndpoint(cap.endpoint)) throw new Error("endpoint failed the safety check");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const method = cap.method.toUpperCase() === "POST" ? "POST" : "GET";
    let url = cap.endpoint;
    const init: RequestInit = { method, redirect: "error", signal: ctrl.signal, headers: { accept: "application/json" } };
    if (method === "GET") {
      const sep = url.includes("?") ? "&" : "?";
      if (arg) url = `${url}${sep}arg=${encodeURIComponent(arg)}`;
    } else {
      init.headers = { ...init.headers, "content-type": "application/json" };
      init.body = JSON.stringify({ arg });
    }
    const r = await fetch(url, init);
    const text = (await r.text()).slice(0, 32_000); // 32KB cap
    if (!r.ok) throw new Error(`capability returned ${r.status}`);
    try { return JSON.parse(text); } catch { return { text }; }
  } finally {
    clearTimeout(t);
  }
}

/** List active registered capabilities (public read). */
export async function listRegistered(limit = 100): Promise<RegisteredCapability[]> {
  try {
    const { data } = await supabase
      .from("signa_capabilities")
      .select("name, provider_address, endpoint, method, description, input_hint, price_usdc, pay_to, ts, calls")
      .is("deregistered_at", null)
      .order("calls", { ascending: false })
      .limit(limit);
    return (data ?? []) as RegisteredCapability[];
  } catch {
    return [];
  }
}

export async function getRegistered(name: string): Promise<RegisteredCapability | null> {
  try {
    const { data } = await supabase
      .from("signa_capabilities")
      .select("name, provider_address, endpoint, method, description, input_hint, price_usdc, pay_to, ts, calls")
      .ilike("name", name)
      .is("deregistered_at", null)
      .limit(1)
      .maybeSingle();
    return (data as RegisteredCapability) ?? null;
  } catch {
    return null;
  }
}

/** Insert/replace a capability (service-role write — anon cannot do this). */
export async function saveCapability(rec: {
  name: string; provider_address: string; endpoint: string; method: string;
  description: string; input_hint?: string; price_usdc: number; pay_to?: string; ts: number; signature: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = serverClient();
  // a provider may update its own capability; a different provider can't take the name
  const existing = await getRegistered(rec.name);
  if (existing && existing.provider_address.toLowerCase() !== rec.provider_address.toLowerCase()) {
    return { ok: false, error: "name_taken_by_another_provider" };
  }
  if (existing) {
    const { error } = await db
      .from("signa_capabilities")
      .update({ endpoint: rec.endpoint, method: rec.method.toUpperCase(), description: rec.description, input_hint: rec.input_hint ?? null, price_usdc: rec.price_usdc, pay_to: rec.pay_to ?? null, ts: rec.ts, signature: rec.signature })
      .ilike("name", rec.name).is("deregistered_at", null);
    return error ? { ok: false, error: error.message } : { ok: true };
  }
  const { error } = await db.from("signa_capabilities").insert({
    name: rec.name, provider_address: rec.provider_address.toLowerCase(), endpoint: rec.endpoint,
    method: rec.method.toUpperCase(), description: rec.description, input_hint: rec.input_hint ?? null,
    price_usdc: rec.price_usdc, pay_to: rec.pay_to ?? null, ts: rec.ts, signature: rec.signature,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function bumpCalls(name: string): Promise<void> {
  try {
    const db = serverClient();
    const cur = await getRegistered(name);
    if (cur) await db.from("signa_capabilities").update({ calls: (cur.calls ?? 0) + 1 }).ilike("name", name).is("deregistered_at", null);
  } catch { /* best-effort */ }
}
