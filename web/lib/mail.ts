/**
 * SIGNA Mail — human-readable handles (you@signa) for wallet inboxes.
 *
 * A handle is owned by whoever wallet-signs the claim. Ownership is verified
 * cryptographically at CLAIM time AND re-verified at RESOLVE time: the stored
 * signature must recover to the stored address, or the handle is ignored. So a
 * handle can never point to a wallet that didn't sign for it — no spoofing,
 * even though the table takes shape-checked anon inserts.
 */
import { recoverMessageAddress, type Hex } from "viem";
import type { SupabaseClient } from "@supabase/supabase-js";

export const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
const RESERVED = new Set([
  "signa", "admin", "support", "help", "root", "mail", "inbox", "verify",
  "agent", "signaagent", "official", "team", "base", "bankr", "aeon",
]);

/** Strip any SIGNA suffix (you@signa, you@signa.xyz, you@signaagent.xyz, you.signa) → bare handle. */
export function normalizeHandle(raw: string): string | null {
  let bare = (raw ?? "").trim().toLowerCase();
  bare = bare.replace(/@signa(?:agent)?(?:\.[a-z]+)*$/i, "").replace(/\.signa$/i, "");
  return HANDLE_RE.test(bare) ? bare : null;
}

/** Canonical preimage the wallet signs to claim a handle. */
export function handleClaimPreimage(a: { ts: number; handle: string; address: string }): string {
  return ["SIGNA handle claim v1", `ts:${a.ts}`, `handle:${a.handle.toLowerCase()}`, `address:${a.address.toLowerCase()}`].join("\n");
}

type Row = { handle: string; address: string; signature: string; signed_message: string };

async function rowIsValid(row: Row): Promise<boolean> {
  try {
    const rec = (await recoverMessageAddress({ message: row.signed_message, signature: row.signature as Hex })).toLowerCase();
    return rec === String(row.address).toLowerCase();
  } catch {
    return false;
  }
}

/** Resolve "you@signa" / "you.signa" / "you" → wallet, only if the claim sig verifies. */
export async function resolveHandle(db: SupabaseClient, raw: string): Promise<{ handle: string; address: string } | null> {
  const h = normalizeHandle(raw);
  if (!h) return null;
  const { data } = await db.from("signa_handles").select("handle,address,signature,signed_message").eq("handle", h).maybeSingle();
  if (!data) return null;
  if (!(await rowIsValid(data as Row))) return null;
  return { handle: (data as Row).handle, address: String((data as Row).address).toLowerCase() };
}

/** The (verified) handle a wallet has claimed, if any (earliest claim wins). */
export async function handleForAddress(db: SupabaseClient, address: string): Promise<string | null> {
  if (!/^0x[0-9a-f]{40}$/.test(address.toLowerCase())) return null;
  const { data } = await db
    .from("signa_handles")
    .select("handle,address,signature,signed_message")
    .eq("address", address.toLowerCase())
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  if (!(await rowIsValid(data as Row))) return null;
  return (data as Row).handle;
}

/** Recent claimed handles, each re-verified against its claim signature (display directory). */
export async function listHandles(db: SupabaseClient, limit = 60): Promise<Array<{ handle: string; address: string; created_at: string }>> {
  const { data } = await db
    .from("signa_handles")
    .select("handle,address,signature,signed_message,created_at")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));
  if (!data) return [];
  const out: Array<{ handle: string; address: string; created_at: string }> = [];
  for (const row of data as Array<Row & { created_at: string }>) {
    if (await rowIsValid(row)) out.push({ handle: row.handle, address: String(row.address).toLowerCase(), created_at: row.created_at });
  }
  return out;
}

/** Claim a handle: verify the wallet signature, ensure it's free, insert. */
export async function claimHandle(
  db: SupabaseClient,
  a: { handle: string; address: string; ts: number; signature: string },
): Promise<{ ok: boolean; error?: string; handle?: string }> {
  const handle = (a.handle ?? "").trim().toLowerCase();
  const address = (a.address ?? "").toLowerCase();
  if (!HANDLE_RE.test(handle)) return { ok: false, error: "handle must be 3–20 chars (a-z, 0-9, _)" };
  if (RESERVED.has(handle)) return { ok: false, error: "that handle is reserved" };
  if (!/^0x[0-9a-f]{40}$/.test(address)) return { ok: false, error: "invalid address" };
  if (!a.ts || Math.abs(Date.now() - Number(a.ts)) > 10 * 60_000) return { ok: false, error: "stale timestamp — try again" };
  if (!/^0x[0-9a-fA-F]+$/.test(String(a.signature))) return { ok: false, error: "missing signature" };

  const message = handleClaimPreimage({ ts: a.ts, handle, address });
  let recovered = "";
  try { recovered = (await recoverMessageAddress({ message, signature: a.signature as Hex })).toLowerCase(); } catch { /* invalid */ }
  if (recovered !== address) return { ok: false, error: "signature does not match the connected wallet" };

  const { data: taken } = await db.from("signa_handles").select("handle").eq("handle", handle).maybeSingle();
  if (taken) return { ok: false, error: "that handle is already taken" };

  const { error } = await db.from("signa_handles").insert({ handle, address, ts: a.ts, signature: a.signature, signed_message: message });
  if (error) return { ok: false, error: /duplicate|unique/i.test(error.message) ? "that handle is already taken" : error.message };
  return { ok: true, handle };
}
