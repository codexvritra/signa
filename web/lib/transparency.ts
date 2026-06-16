/**
 * The SIGNA transparency log — an append-only, tamper-evident Merkle log over
 * the signed message layer (agent_dms), RFC 6962 style.
 *
 * Signatures already prove who wrote each message. This adds the missing
 * guarantee: the central store cannot silently drop, reorder, or alter
 * messages without breaking a published, signed (and on-chain anchorable)
 * Merkle root. Anyone can fetch the ordered entries, rebuild the tree, and
 * re-verify every checkpoint, inclusion proof, and consistency proof offline.
 *
 * Checkpoints are signed by the transparency-log signer
 * (keccak256("signa:transparency-log:v1")), the same deterministic
 * service-identity convention as the gateway / brain / x402 attestor.
 */
import { createHash } from "node:crypto";
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, toBytes } from "viem";
import type { SupabaseClient } from "@supabase/supabase-js";
import { leafHash, merkleRoot, inclusionPath, consistencyProof } from "./merkle-log";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export const LOG_SIGNER_ACCOUNT = privateKeyToAccount(keccak256(toBytes("signa:transparency-log:v1")));
export const LOG_SIGNER = LOG_SIGNER_ACCOUNT.address.toLowerCase();

export type LogMessage = {
  id: string;
  from_address: string;
  to_address: string;
  ts: number;
  body: string;
  signature: string | null;
  created_at: string;
};

export type Checkpoint = {
  seq: number;
  tree_size: number;
  prev_root: string;
  root: string;
  count_added: number;
  range_to: string | null;
  ts: number;
  signature: string;
  signed_message: string;
  anchor_tx: string | null;
  created_at?: string;
};

/**
 * Canonical leaf entry for one message. Binds identity + content digest +
 * the author's signature, so the leaf changes if ANY of them is altered.
 * sha256(body) keeps leaves bounded and avoids embedding large bodies.
 */
export function leafEntry(m: LogMessage): string {
  return [
    "SIGNA log leaf v1",
    `id:${m.id}`,
    `from:${(m.from_address || "").toLowerCase()}`,
    `to:${(m.to_address || "").toLowerCase()}`,
    `ts:${m.ts}`,
    `body:${sha256(m.body ?? "")}`,
    `sig:${m.signature ?? ""}`,
  ].join("\n");
}

/** The canonical checkpoint preimage the log signer signs. */
export function checkpointPreimage(c: { seq: number; tree_size: number; prev_root: string; root: string; ts: number }): string {
  return [
    "SIGNA log checkpoint v1",
    `seq:${c.seq}`,
    `size:${c.tree_size}`,
    `prev:${c.prev_root}`,
    `root:${c.root}`,
    `ts:${c.ts}`,
  ].join("\n");
}

/**
 * Read the full ordered message log. Deterministic order — (created_at, id) —
 * so the tree is reproducible by anyone. Paginated to cover the whole table.
 */
export async function readLog(db: SupabaseClient): Promise<LogMessage[]> {
  const out: LogMessage[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("agent_dms")
      .select("id, from_address, to_address, ts, body, signature, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as LogMessage[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

export async function latestCheckpoint(db: SupabaseClient): Promise<Checkpoint | null> {
  const { data } = await db
    .from("signa_log_checkpoints")
    .select("*")
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Checkpoint) ?? null;
}

const EMPTY_ROOT = sha256(""); // not used as a leaf; readable genesis marker

/**
 * Advance the log: if new messages exist since the last checkpoint, compute a
 * fresh Merkle root over ALL leaves, sign it, and append a checkpoint. Returns
 * the latest checkpoint (new or existing). Idempotent — a no-op when nothing
 * was added. Guarded against the seq primary-key race by ignoring conflicts.
 */
export async function tick(db: SupabaseClient, nowMs: number): Promise<Checkpoint | null> {
  const msgs = await readLog(db);
  const size = msgs.length;
  const prev = await latestCheckpoint(db);
  if (prev && prev.tree_size === size) return prev; // nothing new
  if (size === 0) return prev;

  const leaves = msgs.map((m) => leafHash(leafEntry(m)));
  const root = merkleRoot(leaves);
  const seq = prev ? prev.seq + 1 : 0;
  const prevRoot = prev ? prev.root : ""; // genesis prev is empty string
  const pre = checkpointPreimage({ seq, tree_size: size, prev_root: prevRoot, root, ts: nowMs });
  const signature = await LOG_SIGNER_ACCOUNT.signMessage({ message: pre });

  const row: Checkpoint = {
    seq,
    tree_size: size,
    prev_root: prevRoot,
    root,
    count_added: size - (prev ? prev.tree_size : 0),
    range_to: msgs[size - 1]?.created_at ?? null,
    ts: nowMs,
    signature,
    signed_message: pre,
    anchor_tx: null,
  };
  const { error } = await db.from("signa_log_checkpoints").insert(row);
  if (error) {
    // lost a race for this seq — return whatever is now latest
    return (await latestCheckpoint(db)) ?? row;
  }
  return row;
}

/**
 * Build an inclusion proof for a message id against the latest checkpoint.
 * Returns null if the message isn't in the log yet (e.g. arrived after the
 * last checkpoint — caller can tick() then retry).
 */
export async function inclusionFor(
  db: SupabaseClient,
  messageId: string,
): Promise<
  | {
      message_id: string;
      leaf_index: number;
      leaf_hash: string;
      leaf_entry: string;
      tree_size: number;
      audit_path: string[];
      checkpoint: Checkpoint;
    }
  | null
> {
  const cp = await latestCheckpoint(db);
  if (!cp) return null;
  const msgs = await readLog(db);
  const leavesAll = msgs.map((m) => leafEntry(m));
  // proof must be against the checkpoint's tree_size, not the live size
  const covered = msgs.slice(0, cp.tree_size);
  const idx = covered.findIndex((m) => m.id === messageId);
  if (idx < 0) return null;
  const leafHashes = covered.map((m) => leafHash(leafEntry(m)));
  return {
    message_id: messageId,
    leaf_index: idx,
    leaf_hash: leafHashes[idx],
    leaf_entry: leavesAll[idx],
    tree_size: cp.tree_size,
    audit_path: inclusionPath(idx, leafHashes),
    checkpoint: cp,
  };
}

/**
 * Consistency proof between an older checkpoint (size `first`) and the latest
 * checkpoint, proving the log is append-only between them.
 */
export async function consistencyFor(
  db: SupabaseClient,
  first: number,
): Promise<{ first: number; first_root: string | null; second: number; second_root: string; proof: string[] } | null> {
  const cp = await latestCheckpoint(db);
  if (!cp) return null;
  if (first <= 0 || first > cp.tree_size) return null;
  const msgs = await readLog(db);
  const leafHashes = msgs.slice(0, cp.tree_size).map((m) => leafHash(leafEntry(m)));
  const olderRoot = merkleRoot(leafHashes.slice(0, first));
  const { data: firstCp } = await db
    .from("signa_log_checkpoints")
    .select("root")
    .eq("tree_size", first)
    .order("seq", { ascending: true })
    .limit(1)
    .maybeSingle();
  return {
    first,
    first_root: (firstCp as { root: string } | null)?.root ?? olderRoot,
    second: cp.tree_size,
    second_root: cp.root,
    proof: consistencyProof(first, leafHashes),
  };
}

export { EMPTY_ROOT };
