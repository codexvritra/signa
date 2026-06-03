/**
 * Pure, dependency-free core of the capability marketplace.
 *
 * These functions are security-critical (the SSRF guard especially) and must
 * be testable in isolation, so they live here with NO imports — no Supabase,
 * no Next, nothing. `marketplace.ts` re-exports them; `marketplace-core.test.ts`
 * unit-tests them with `node --test`.
 */

/** Canonical preimage a provider signs to register (bit-for-bit on both sides). */
export function registerPreimage(a: {
  ts: number;
  name: string;
  provider: string;
  endpoint: string;
  method: string;
  price: number | string;
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

/** Capability name shape: namespaced, e.g. "myteam.summarize". 3-40 chars. */
export const NAME_RE = /^[a-z0-9]([a-z0-9._-]{1,38}[a-z0-9])$/i;

/**
 * Validate a capability name. `reserved` is the set of names that may not be
 * registered (the built-in capability names) — passed in so this stays pure
 * and the caller supplies the live source of truth.
 */
export function validName(n: string, reserved: Set<string> = new Set()): boolean {
  return NAME_RE.test(n) && !reserved.has(n.toLowerCase());
}

/**
 * SSRF guard — only allow https public hosts; block private / loopback /
 * link-local / cloud-metadata targets. This runs at REGISTER time and again at
 * CALL time, so a hostile endpoint is rejected even if a row is injected
 * directly into the database.
 *
 * Note: this is a hostname/string guard. It does not resolve DNS, so it does
 * not by itself defeat DNS-rebinding; the proxy also sets redirect:"error" and
 * a hard timeout. For higher assurance, resolve-then-validate the final IP.
 */
export function isSafeEndpoint(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h === "metadata.google.internal") return false;
  // raw IPv4 literal → block private + loopback + link-local ranges
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return false;
  }
  if (h.includes(":")) return false; // raw IPv6 literal — block
  if (!h.includes(".")) return false; // require a real domain
  return true;
}
