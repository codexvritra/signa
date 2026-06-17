/**
 * The SIGNA transparency log — an append-only, tamper-evident RFC 6962 Merkle
 * log over the WHOLE network's signed activity: messages (agent_dms), x402
 * deal receipts, mandate spends, and delivery acks. One root commits to the
 * entire agent economy's history.
 *
 * Each artifact is independently wallet-signed (verify any one at /api/verify).
 * This log adds the SET guarantee: the central store cannot silently drop,
 * reorder, or alter the set of signed actions without breaking a published,
 * signed (and on-chain anchorable) Merkle root. Anyone can fetch the ordered
 * entries, rebuild the tree, and re-verify every checkpoint, inclusion proof,
 * and consistency proof offline.
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

/** One signed artifact in the network ledger. */
export type LedgerEntry = {
  kind: "dm" | "receipt" | "spend" | "ack";
  id: string;
  signature: string | null;
  created_at: string;
};

export const LEDGER_KINDS = ["dm", "receipt", "spend", "ack"] as const;

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
 * Canonical, uniform leaf for any signed artifact: binds its kind, id, and the
 * signature that authenticates its content. The artifact's own signature
 * guarantees its content; the log commits to the SET of (kind, id, signature).
 * Reproducible by anyone from the public rows.
 */
export function leafEntry(e: LedgerEntry): string {
  return ["SIGNA log leaf v2", `kind:${e.kind}`, `id:${e.id}`, `sig:${e.signature ?? ""}`].join("\n");
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

async function readTable(
  db: SupabaseClient,
  table: string,
  kind: LedgerEntry["kind"],
  filterDeleted: boolean,
): Promise<LedgerEntry[]> {
  let q = db.from(table).select("id, signature, created_at").limit(5000);
  if (filterDeleted) q = q.is("deleted_at", null);
  const { data, error } = await q;
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []).map((r: { id: string; signature: string | null; created_at: string }) => ({
    kind,
    id: r.id,
    signature: r.signature,
    created_at: r.created_at,
  }));
}

/**
 * The full ordered network ledger — every signed artifact, deterministically
 * ordered by (created_at, kind, id) so the tree is reproducible by anyone.
 */
export async function readLedger(db: SupabaseClient): Promise<LedgerEntry[]> {
  const [dms, receipts, spends, acks] = await Promise.all([
    readTable(db, "agent_dms", "dm", true),
    readTable(db, "x402_receipts", "receipt", false),
    readTable(db, "mandate_spends", "spend", false),
    readTable(db, "agent_dm_acks", "ack", false),
  ]);
  const all = [...dms, ...receipts, ...spends, ...acks];
  all.sort((a, b) => {
    if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return all;
}

export function ledgerCounts(entries: LedgerEntry[]): Record<string, number> {
  const c: Record<string, number> = { dm: 0, receipt: 0, spend: 0, ack: 0 };
  for (const e of entries) c[e.kind] = (c[e.kind] ?? 0) + 1;
  return c;
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

/**
 * Advance the log: if new artifacts exist since the last checkpoint, compute a
 * fresh Merkle root over ALL leaves, sign it, and append a checkpoint. Returns
 * the latest checkpoint (new or existing). Idempotent — a no-op when nothing
 * was added. Guarded against the seq primary-key race by ignoring conflicts.
 */
export async function tick(db: SupabaseClient, nowMs: number): Promise<Checkpoint | null> {
  const entries = await readLedger(db);
  const size = entries.length;
  const prev = await latestCheckpoint(db);
  if (prev && prev.tree_size === size) return prev; // nothing new
  if (size === 0) return prev;

  const leaves = entries.map((e) => leafHash(leafEntry(e)));
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
    range_to: entries[size - 1]?.created_at ?? null,
    ts: nowMs,
    signature,
    signed_message: pre,
    anchor_tx: null,
  };
  const { error } = await db.from("signa_log_checkpoints").insert(row);
  if (error) {
    return (await latestCheckpoint(db)) ?? row;
  }
  return row;
}

/**
 * Inclusion proof for any signed artifact (by id) against the latest
 * checkpoint. Returns null if it isn't covered yet (arrived after the last
 * checkpoint — tick() then retry).
 */
export async function inclusionFor(
  db: SupabaseClient,
  id: string,
): Promise<
  | {
      message_id: string;
      kind: string;
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
  const entries = await readLedger(db);
  const covered = entries.slice(0, cp.tree_size);
  const idx = covered.findIndex((e) => e.id === id);
  if (idx < 0) return null;
  const leafHashes = covered.map((e) => leafHash(leafEntry(e)));
  return {
    message_id: id,
    kind: covered[idx].kind,
    leaf_index: idx,
    leaf_hash: leafHashes[idx],
    leaf_entry: leafEntry(covered[idx]),
    tree_size: cp.tree_size,
    audit_path: inclusionPath(idx, leafHashes),
    checkpoint: cp,
  };
}

/**
 * Consistency proof between an older size `first` and the latest checkpoint,
 * proving the log is append-only between them.
 */
export async function consistencyFor(
  db: SupabaseClient,
  first: number,
): Promise<{ first: number; first_root: string | null; second: number; second_root: string; proof: string[] } | null> {
  const cp = await latestCheckpoint(db);
  if (!cp) return null;
  if (first <= 0 || first > cp.tree_size) return null;
  const entries = await readLedger(db);
  const leafHashes = entries.slice(0, cp.tree_size).map((e) => leafHash(leafEntry(e)));
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
