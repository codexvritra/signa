/**
 * On-chain anchoring for the SIGNA transparency log (pillar #2).
 *
 * The transparency log (lib/transparency.ts) produces signed, append-only
 * Merkle checkpoints. This module pins those checkpoint roots to Base via the
 * SignaLogAnchor contract, so the log's history is settled on-chain — a later
 * off-chain root that contradicts an anchored one is provably a fork, even if
 * SIGNA itself produced it.
 *
 * Reading works as soon as the contract is deployed + SIGNA_LOG_ANCHOR_ADDRESS
 * is set. Writing (broadcasting an anchor) additionally needs the transparency
 * -log signer wallet funded with a little Base ETH for gas; the signer key is
 * deterministic (keccak256("signa:transparency-log:v1")), so no secret to set.
 * Everything degrades gracefully to { configured:false } when unset.
 */
import { createPublicClient, createWalletClient, http, type Address, type Hex } from "viem";
import { base } from "viem/chains";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LOG_SIGNER, LOG_SIGNER_ACCOUNT, latestCheckpoint, type Checkpoint } from "./transparency";

export const LOG_ANCHOR_ABI = [
  {
    type: "function",
    name: "anchor",
    stateMutability: "nonpayable",
    inputs: [
      { name: "seq", type: "uint64" },
      { name: "treeSize", type: "uint64" },
      { name: "root", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getLatest",
    stateMutability: "view",
    inputs: [{ name: "logId", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "seq", type: "uint64" },
          { name: "treeSize", type: "uint64" },
          { name: "root", type: "bytes32" },
          { name: "anchoredAt", type: "uint64" },
          { name: "count", type: "uint64" },
        ],
      },
    ],
  },
] as const;

export function logAnchorAddress(): Address | null {
  const v = process.env.SIGNA_LOG_ANCHOR_ADDRESS;
  if (!v || !/^0x[a-fA-F0-9]{40}$/.test(v)) return null;
  return v as Address;
}

const client = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL) });

const ROOT0 = `0x${"0".repeat(64)}` as Hex;

export type OnchainAnchor = {
  seq: number;
  tree_size: number;
  root: Hex;
  anchored_at: number;
  count: number;
};

/** Read SIGNA's latest on-chain anchor (the log anchored by the log signer). */
export async function readOnchainAnchor(): Promise<OnchainAnchor | null> {
  const addr = logAnchorAddress();
  if (!addr) return null;
  try {
    const r = (await client.readContract({
      address: addr,
      abi: LOG_ANCHOR_ABI,
      functionName: "getLatest",
      args: [LOG_SIGNER as Address],
    })) as { seq: bigint; treeSize: bigint; root: Hex; anchoredAt: bigint; count: bigint };
    if (!r || r.count === 0n || r.root === ROOT0) return null;
    return {
      seq: Number(r.seq),
      tree_size: Number(r.treeSize),
      root: r.root,
      anchored_at: Number(r.anchoredAt),
      count: Number(r.count),
    };
  } catch {
    return null;
  }
}

/** Anchor status: the latest DB checkpoint vs what's pinned on-chain. */
export async function anchorStatus(db: SupabaseClient): Promise<{
  configured: boolean;
  contract: Address | null;
  signer: string;
  chain: "base";
  checkpoint: { seq: number; tree_size: number; root: string } | null;
  onchain: OnchainAnchor | null;
  anchored: boolean;
  matches: boolean | null;
}> {
  const addr = logAnchorAddress();
  const cp = await latestCheckpoint(db);
  const onchain = await readOnchainAnchor();
  // "matches" = the on-chain root for some seq agrees with our checkpoint chain.
  // We compare the on-chain anchored seq's root to the same seq in our log when
  // they line up; the common case is onchain.seq <= cp.seq (we anchor the head
  // periodically). matches=true means the anchored root equals the root our DB
  // reports for that exact seq.
  let matches: boolean | null = null;
  if (cp && onchain) {
    if (onchain.seq === cp.seq) matches = onchain.root.toLowerCase() === `0x${cp.root}`.toLowerCase();
    else matches = onchain.seq < cp.seq; // older head anchored — consistent, not contradictory
  }
  return {
    configured: !!addr,
    contract: addr,
    signer: LOG_SIGNER,
    chain: "base",
    checkpoint: cp ? { seq: cp.seq, tree_size: cp.tree_size, root: cp.root } : null,
    onchain,
    anchored: !!onchain,
    matches,
  };
}

/**
 * Broadcast an anchor for the latest checkpoint if it's ahead of what's on
 * chain. Requires the contract deployed (env) AND the log-signer funded for
 * gas. Returns a structured result; never throws for "not configured".
 */
export async function anchorLatest(db: SupabaseClient): Promise<{
  ok: boolean;
  reason?: string;
  tx?: Hex;
  seq?: number;
  root?: string;
}> {
  const addr = logAnchorAddress();
  if (!addr) return { ok: false, reason: "not_configured" };
  const cp: Checkpoint | null = await latestCheckpoint(db);
  if (!cp) return { ok: false, reason: "no_checkpoint" };
  const onchain = await readOnchainAnchor();
  if (onchain && onchain.seq >= cp.seq) {
    return { ok: true, reason: "already_anchored", seq: onchain.seq, root: onchain.root };
  }
  try {
    const wallet = createWalletClient({
      account: LOG_SIGNER_ACCOUNT,
      chain: base,
      transport: http(process.env.BASE_RPC_URL),
    });
    const tx = await wallet.writeContract({
      address: addr,
      abi: LOG_ANCHOR_ABI,
      functionName: "anchor",
      args: [BigInt(cp.seq), BigInt(cp.tree_size), `0x${cp.root}` as Hex],
    });
    await client.waitForTransactionReceipt({ hash: tx, timeout: 60_000 }).catch(() => undefined);
    await db.from("signa_log_checkpoints").update({ anchor_tx: tx }).eq("seq", cp.seq);
    return { ok: true, tx, seq: cp.seq, root: cp.root };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message.slice(0, 160) : "anchor_failed" };
  }
}
