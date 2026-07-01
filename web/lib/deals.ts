/**
 * SIGNA Agent Deals — the verifiable agreement layer for agents on Base.
 *
 * The agent economy has payment (x402), identity (ERC-8004), and job escrow
 * (ERC-8183) — but nothing that proves two specific agents *agreed to the same
 * terms*. A Deal fixes that: a chain of wallet-signed messages where BOTH sides
 * sign the identical terms, so the agreement re-verifies with no trust.
 *
 *   offer   — the buyer signs { to, task, amount, asset, deadline }         → deal_id = keccak256(offer)
 *   accept  — the seller signs the deal_id (= the exact terms)              → both bound to identical terms
 *   deliver — the seller signs the result                                   → work submitted
 *   settle  — the buyer signs the payment reference (paid via /pay, x402…)  → done
 *
 * States mirror ERC-8183 (Open → Accepted → Delivered → Settled). from = buyer
 * (pays), to = seller (delivers). Every step is re-verifiable at /api/verify.
 */
import { keccak256, toBytes, recoverMessageAddress, type Address } from "viem";
import type { SupabaseClient } from "@supabase/supabase-js";

const norm = (a: string) => (a || "").toLowerCase();
export const MAX_TASK = 2000;
export const MAX_RESULT = 8000;

export type DealStatus = "open" | "accepted" | "delivered" | "settled" | "cancelled";
export type Deal = {
  deal_id: string;
  from_address: string; // buyer (pays)
  to_address: string;   // seller (delivers)
  task: string;
  amount: string;       // human/raw units (freeform, e.g. "5" or "5000000")
  asset: string;        // token address or symbol
  deadline: string;
  ts: number;
  offer_signature: string;
  status: DealStatus;
  accept_sig?: string | null;
  accept_ts?: number | null;
  result?: string | null;
  result_sig?: string | null;
  result_ts?: number | null;
  settle_ref?: string | null;
  settle_sig?: string | null;
  settle_ts?: number | null;
  created_at?: string;
};

// ───────────────────────── canonical preimages ─────────────────────────

export function dealOfferPreimage(a: { ts: number; from: string; to: string; task: string; amount: string; asset: string; deadline: string }): string {
  return [
    "SIGNA deal offer v1",
    `ts:${a.ts}`,
    `from:${norm(a.from)}`,
    `to:${norm(a.to)}`,
    `task:${a.task}`,
    `amount:${a.amount}`,
    `asset:${norm(a.asset)}`,
    `deadline:${a.deadline}`,
  ].join("\n");
}
/** Deterministic, tamper-evident deal id = keccak256 of the exact offer terms. */
export function dealIdFromOffer(a: { ts: number; from: string; to: string; task: string; amount: string; asset: string; deadline: string }): string {
  return keccak256(toBytes(dealOfferPreimage(a)));
}
export function dealAcceptPreimage(a: { ts: number; deal: string; accepter: string }): string {
  return ["SIGNA deal accept v1", `ts:${a.ts}`, `deal:${a.deal}`, `accepter:${norm(a.accepter)}`].join("\n");
}
export function dealDeliverPreimage(a: { ts: number; deal: string; worker: string; result: string }): string {
  return ["SIGNA deal deliver v1", `ts:${a.ts}`, `deal:${a.deal}`, `worker:${norm(a.worker)}`, `result:${a.result}`].join("\n");
}
export function dealSettlePreimage(a: { ts: number; deal: string; payer: string; payment: string }): string {
  return ["SIGNA deal settle v1", `ts:${a.ts}`, `deal:${a.deal}`, `payer:${norm(a.payer)}`, `payment:${a.payment}`].join("\n");
}

async function recovers(message: string, signature: string, expected: string): Promise<boolean> {
  try {
    const rec = await recoverMessageAddress({ message, signature: signature as `0x${string}` });
    return norm(rec) === norm(expected);
  } catch {
    return false;
  }
}

// ───────────────────────── writes (verify → persist) ─────────────────────────

export async function postOffer(
  db: SupabaseClient,
  b: { from: string; to: string; task: string; amount: string; asset: string; deadline: string; ts: number; signature: string },
): Promise<{ ok: boolean; error?: string; deal?: Deal }> {
  const from = norm(b.from), to = norm(b.to);
  if (!/^0x[0-9a-f]{40}$/.test(from) || !/^0x[0-9a-f]{40}$/.test(to)) return { ok: false, error: "bad_address" };
  if (from === to) return { ok: false, error: "from_and_to_equal" };
  if (!b.task || b.task.length > MAX_TASK) return { ok: false, error: "bad_task" };
  const terms = { ts: b.ts, from, to, task: b.task, amount: String(b.amount ?? ""), asset: norm(b.asset || "USDC"), deadline: String(b.deadline ?? "") };
  if (!(await recovers(dealOfferPreimage(terms), b.signature, from))) return { ok: false, error: "bad_offer_signature" };
  const deal_id = dealIdFromOffer(terms);
  const row = {
    deal_id, from_address: from, to_address: to, task: terms.task, amount: terms.amount, asset: terms.asset,
    deadline: terms.deadline, ts: b.ts, offer_signature: b.signature, status: "open" as DealStatus,
  };
  const { error } = await db.from("agent_deals").upsert(row, { onConflict: "deal_id" });
  if (error) return { ok: false, error: error.message };
  return { ok: true, deal: row };
}

export async function acceptDeal(db: SupabaseClient, b: { deal: string; accepter: string; ts: number; signature: string }): Promise<{ ok: boolean; error?: string }> {
  const deal = await getDeal(db, b.deal);
  if (!deal) return { ok: false, error: "deal_not_found" };
  if (deal.status !== "open") return { ok: false, error: `not_open (${deal.status})` };
  if (norm(b.accepter) !== deal.to_address) return { ok: false, error: "only_counterparty_can_accept" };
  if (!(await recovers(dealAcceptPreimage({ ts: b.ts, deal: b.deal, accepter: b.accepter }), b.signature, deal.to_address))) return { ok: false, error: "bad_accept_signature" };
  const { error } = await db.from("agent_deals").update({ status: "accepted", accept_sig: b.signature, accept_ts: b.ts }).eq("deal_id", b.deal).eq("status", "open");
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deliverDeal(db: SupabaseClient, b: { deal: string; worker: string; result: string; ts: number; signature: string }): Promise<{ ok: boolean; error?: string }> {
  const deal = await getDeal(db, b.deal);
  if (!deal) return { ok: false, error: "deal_not_found" };
  if (deal.status !== "accepted") return { ok: false, error: `not_accepted (${deal.status})` };
  if (norm(b.worker) !== deal.to_address) return { ok: false, error: "only_seller_can_deliver" };
  if (!b.result || b.result.length > MAX_RESULT) return { ok: false, error: "bad_result" };
  if (!(await recovers(dealDeliverPreimage({ ts: b.ts, deal: b.deal, worker: b.worker, result: b.result }), b.signature, deal.to_address))) return { ok: false, error: "bad_deliver_signature" };
  const { error } = await db.from("agent_deals").update({ status: "delivered", result: b.result, result_sig: b.signature, result_ts: b.ts }).eq("deal_id", b.deal).eq("status", "accepted");
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function settleDeal(db: SupabaseClient, b: { deal: string; payer: string; payment: string; ts: number; signature: string }): Promise<{ ok: boolean; error?: string }> {
  const deal = await getDeal(db, b.deal);
  if (!deal) return { ok: false, error: "deal_not_found" };
  if (deal.status !== "delivered") return { ok: false, error: `not_delivered (${deal.status})` };
  if (norm(b.payer) !== deal.from_address) return { ok: false, error: "only_buyer_can_settle" };
  if (!(await recovers(dealSettlePreimage({ ts: b.ts, deal: b.deal, payer: b.payer, payment: b.payment }), b.signature, deal.from_address))) return { ok: false, error: "bad_settle_signature" };
  const { error } = await db.from("agent_deals").update({ status: "settled", settle_ref: b.payment, settle_sig: b.signature, settle_ts: b.ts }).eq("deal_id", b.deal).eq("status", "delivered");
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ───────────────────────── reads ─────────────────────────

export async function getDeal(db: SupabaseClient, deal_id: string): Promise<Deal | null> {
  const { data } = await db.from("agent_deals").select("*").eq("deal_id", deal_id).maybeSingle();
  return (data as Deal) ?? null;
}
export async function listDeals(db: SupabaseClient, limit = 50): Promise<Deal[]> {
  const { data } = await db.from("agent_deals").select("*").order("created_at", { ascending: false }).limit(Math.min(Math.max(limit, 1), 100));
  return (data as Deal[]) ?? [];
}
export async function dealsForAgent(db: SupabaseClient, address: string, limit = 50): Promise<Deal[]> {
  const a = norm(address);
  const { data } = await db.from("agent_deals").select("*").or(`from_address.eq.${a},to_address.eq.${a}`).order("created_at", { ascending: false }).limit(Math.min(Math.max(limit, 1), 100));
  return (data as Deal[]) ?? [];
}
