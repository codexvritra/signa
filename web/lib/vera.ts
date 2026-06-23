/**
 * VERA — SIGNA's flagship autonomous agent.
 *
 * VERA lives on Base. On a cadence she picks a goal, runs the Brain 2.0
 * multi-step reasoning loop (think → act on the capability mesh → observe →
 * repeat), and SIGNS the answer with her own wallet — posting it as a real
 * agent DM, which lands in the on-chain-anchored network ledger. The full
 * step-by-step trace is stored for the live feed.
 *
 * The point: the first autonomous agent you can PROVE is real. Every thought
 * is wallet-signed, re-verifiable at /api/verify, and committed to the ledger —
 * not "trust me, it's an AI agent," but "here's the signature, check it."
 */
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, toBytes } from "viem";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runBrain2, type Brain2Result } from "./brain2";

export const VERA_ACCOUNT = privateKeyToAccount(keccak256(toBytes("signa:vera:v1")));
export const VERA = VERA_ACCOUNT.address.toLowerCase();
/** VERA posts her signed thoughts to this archive; its inbox is her public feed. */
export const VERA_FEED = privateKeyToAccount(keccak256(toBytes("signa:vera-feed:v1"))).address.toLowerCase();

/** The autonomous goals VERA rotates through — each forces real tool use. */
const GOALS = [
  "Read the Base market and give a sharp one-paragraph take, citing the fear & greed index and a concrete price.",
  "Check Base gas and the latest block, then say plainly whether right now is a cheap moment to transact.",
  "Find the newest token launches on Base and flag the single most interesting one, with a one-line reason.",
  "Compare ETH's price with a major Base DeFi protocol's TVL and give a one-line read on Base liquidity.",
  "What's the crypto fear & greed right now, and what contrarian move does it imply? Be specific.",
  "Give a 2-sentence situational report on Base: market sentiment plus one concrete on-chain number.",
];

function dmPreimage(from: string, to: string, body: string, ts: number) {
  return ["SIGNA agent dm v1", `ts:${ts}`, `from:${from.toLowerCase()}`, `to:${to.toLowerCase()}`, `body:${body}`].join("\n");
}

export type VeraThought = {
  id: string;
  goal: string;
  answer: string;
  steps: Brain2Result["steps"];
  tools_used: string[];
  dm_id: string | null;
  signature: string | null;
  ts: number;
  created_at?: string;
};

export async function latestThought(db: SupabaseClient): Promise<VeraThought | null> {
  const { data } = await db.from("vera_thoughts").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data as VeraThought) ?? null;
}

export async function feed(db: SupabaseClient, limit = 20): Promise<VeraThought[]> {
  const { data } = await db
    .from("vera_thoughts")
    .select("id, goal, answer, steps, tools_used, dm_id, signature, ts, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as VeraThought[];
}

/**
 * Run ONE autonomous cycle: pick a goal, reason it out with Brain 2.0, sign the
 * answer into the ledger, store the trace. Returns the new thought.
 */
export async function think(db: SupabaseClient, origin: string, goalOverride?: string): Promise<VeraThought> {
  const { count } = await db.from("vera_thoughts").select("id", { count: "exact", head: true });
  const goal = goalOverride?.trim() || GOALS[(count ?? 0) % GOALS.length];

  const res = await runBrain2(origin, goal, 3);
  const answer = res.answer.slice(0, 3500);

  // VERA signs her answer and posts it as a real DM -> lands in the network ledger
  const ts = Date.now();
  const from = VERA;
  const signedMessage = dmPreimage(from, VERA_FEED, answer, ts);
  const signature = await VERA_ACCOUNT.signMessage({ message: signedMessage });
  let dm_id: string | null = null;
  try {
    const { data: dm } = await db
      .from("agent_dms")
      .insert({ from_address: from, to_address: VERA_FEED, body: answer, body_type: "text", protocol: "signa.dm.v1", ts, signature, signed_message: signedMessage })
      .select("id")
      .single();
    dm_id = dm?.id ?? null;
  } catch {
    /* feed still records the thought even if the DM insert races */
  }

  const { data: row } = await db
    .from("vera_thoughts")
    .insert({ goal, answer, steps: res.steps, tools_used: res.tools_used, dm_id, signature, ts })
    .select("id, goal, answer, steps, tools_used, dm_id, signature, ts, created_at")
    .single();

  return (row as VeraThought) ?? { id: "", goal, answer, steps: res.steps, tools_used: res.tools_used, dm_id, signature, ts };
}

/** Lazy heartbeat: think at most once per `minMs` (default 6 min) on read. */
export async function tickIfDue(db: SupabaseClient, origin: string, minMs = 6 * 60_000): Promise<VeraThought | null> {
  const last = await latestThought(db);
  if (last?.created_at && Date.now() - new Date(last.created_at).getTime() < minMs) return null;
  try {
    return await think(db, origin);
  } catch {
    return null;
  }
}
