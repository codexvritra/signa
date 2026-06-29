/**
 * Onchain messaging — write a message into a Base transaction's calldata, so it
 * lives on-chain forever and is readable straight from the chain (no database).
 * The transaction itself is signed by the sender's wallet, so the chain proves
 * who sent it. A 0-value tx to the recipient with the message in `data`.
 *
 * Sending costs gas (cents on Base) — it's the permanent, censorship-resistant
 * option alongside the free, instant signed DM. Reading needs nothing but an RPC.
 */
import { toHex, hexToString, createPublicClient, http, type Address } from "viem";
import { base } from "viem/chains";
import type { SupabaseClient } from "@supabase/supabase-js";

const PREFIX = "SIGNA msg v1";

/** Build the unsigned Base tx that writes a message on-chain (sender broadcasts it). */
export function buildOnchainMessageTx(a: { from: string; to: string; body: string }): { to: string; value: string; data: string } {
  const canonical = `${PREFIX}\nfrom:${a.from.toLowerCase()}\nto:${a.to.toLowerCase()}\nbody:${a.body}`;
  return { to: a.to.toLowerCase(), value: "0x0", data: toHex(canonical) };
}

/** Decode a tx input back into a SIGNA message, or null if it isn't one. */
export function decodeOnchainMessage(inputHex: string): { from: string; to: string; body: string } | null {
  try {
    if (!inputHex || inputHex === "0x") return null;
    const s = hexToString(inputHex as `0x${string}`);
    if (!s.startsWith(PREFIX)) return null;
    const from = (s.match(/\nfrom:([^\n]*)/)?.[1] ?? "").trim().toLowerCase();
    const to = (s.match(/\nto:([^\n]*)/)?.[1] ?? "").trim().toLowerCase();
    const i = s.indexOf("\nbody:");
    const body = i >= 0 ? s.slice(i + 6) : "";
    return { from, to, body };
  } catch { return null; }
}

// typed `any`: the monorepo resolves multiple viem copies (pinned PublicClient clashes)
let _client: any = null;
function client(): any {
  if (!_client) _client = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL || "https://mainnet.base.org") });
  return _client;
}

/** Read a SIGNA message back from a Base transaction hash — straight from the chain. */
export async function readOnchainMessage(txHash: string): Promise<
  { tx: string; tx_from: string; tx_to: string; from: string; to: string; body: string; block: string; sender_matches: boolean } | null
> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) return null;
  let tx: { from: string; to: string | null; input: string; blockNumber: bigint };
  try { tx = await client().getTransaction({ hash: txHash as Address }); } catch { return null; }
  const msg = decodeOnchainMessage(tx.input);
  if (!msg) return null;
  const txFrom = String(tx.from).toLowerCase();
  return {
    tx: txHash, tx_from: txFrom, tx_to: String(tx.to ?? "").toLowerCase(),
    from: msg.from, to: msg.to, body: msg.body, block: String(tx.blockNumber ?? ""),
    // the chain proves the sender: the tx's from must equal the claimed message from
    sender_matches: txFrom === msg.from,
  };
}

export type OnchainMsg = { tx_hash: string; from_address: string; to_address: string; body: string; block: string | null; created_at: string };

/** Index an onchain message after it's broadcast — only if it really decodes on-chain. */
export async function recordOnchainMessage(db: SupabaseClient, txHash: string): Promise<{ ok: boolean; error?: string; record?: OnchainMsg }> {
  const m = await readOnchainMessage(txHash);
  if (!m) return { ok: false, error: "not_a_signa_onchain_message" };
  if (!m.sender_matches) return { ok: false, error: "tx_sender_mismatch" };
  const row = { tx_hash: m.tx, from_address: m.from, to_address: m.to, body: m.body, block: m.block };
  const { error } = await db.from("onchain_messages").upsert(row, { onConflict: "tx_hash" });
  if (error) return { ok: false, error: error.message };
  return { ok: true, record: { ...row, created_at: new Date().toISOString() } };
}

/** The onchain inbox for a wallet — rows are re-verified against the chain (no forgery). */
export async function onchainInbox(db: SupabaseClient, address: string, limit = 20): Promise<OnchainMsg[]> {
  if (!/^0x[0-9a-f]{40}$/.test(address.toLowerCase())) return [];
  const { data } = await db
    .from("onchain_messages")
    .select("tx_hash,from_address,to_address,body,block,created_at")
    .eq("to_address", address.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50));
  const out: OnchainMsg[] = [];
  for (const row of (data ?? []) as OnchainMsg[]) {
    const m = await readOnchainMessage(row.tx_hash);
    if (m && m.sender_matches && m.from === row.from_address && m.to === row.to_address && m.body === row.body) out.push(row);
  }
  return out;
}
