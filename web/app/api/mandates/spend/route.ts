import { NextRequest, NextResponse } from "next/server";
import { serverClient, supabase } from "@/lib/supabase";
import { verifySignedMessage } from "@/lib/verify-signature";
import { spendPreimage } from "@/lib/mandate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/mandates/spend — an agent records a wallet-signed spend against its
 * mandate. We verify the agent's signature, confirm the mandate is valid and not
 * expired, and that this spend fits BOTH caps: per-purchase and total remaining
 * (computed as the sum of all recorded spends — append-only, never mutated). If
 * it exceeds the mandate we say so + how short it is, so the agent knows to ask
 * for more budget.
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
const json = (b: unknown, i?: ResponseInit) =>
  NextResponse.json(b, { ...i, headers: { ...(i?.headers ?? {}), ...CORS } });

export async function POST(req: NextRequest) {
  let b: any;
  try {
    b = await req.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const mandateId = String(b.mandate_id ?? "");
  const agent = String(b.agent ?? "").toLowerCase();
  const amount = String(b.amount ?? "");
  const note = b.note != null ? String(b.note).slice(0, 280) : "";
  const receiptId = b.receipt_id ? String(b.receipt_id) : null;
  const ts = Number(b.ts ?? 0);
  const signature = String(b.signature ?? "");

  if (!/^[0-9a-f-]{36}$/i.test(mandateId)) return json({ ok: false, error: "invalid_mandate_id" }, { status: 400 });
  if (!/^0x[a-f0-9]{40}$/.test(agent)) return json({ ok: false, error: "invalid_agent" }, { status: 400 });
  let amt: bigint;
  try {
    amt = BigInt(amount);
  } catch {
    return json({ ok: false, error: "invalid_amount" }, { status: 400 });
  }
  if (amt <= 0n) return json({ ok: false, error: "amount_must_be_positive" }, { status: 400 });

  const db = serverClient();
  const { data: mandate } = await db
    .from("spend_mandates")
    .select("id, agent, limit_raw, per_tx_raw, expiry")
    .eq("id", mandateId)
    .maybeSingle();
  if (!mandate) return json({ ok: false, error: "mandate_not_found" }, { status: 404 });
  if (mandate.agent !== agent) return json({ ok: false, error: "agent_not_authorized_by_this_mandate" }, { status: 403 });
  if (Number(mandate.expiry) < Math.floor(Date.now() / 1000)) {
    return json({ ok: false, error: "mandate_expired" }, { status: 403 });
  }

  // verify the agent really authorized this spend
  const message = spendPreimage({ ts, mandateId, agent, amount, note });
  const v = await verifySignedMessage({ expectedAddress: agent, message, signature, ts });
  if (!v.ok) return json({ ok: false, error: v.reason }, { status: 401 });

  const perTx = BigInt(mandate.per_tx_raw);
  const limit = BigInt(mandate.limit_raw);
  if (amt > perTx) {
    return json({ ok: false, error: "exceeds_per_tx_cap", per_tx_raw: mandate.per_tx_raw }, { status: 409 });
  }

  // spent so far = sum of recorded spends (append-only ledger)
  const { data: spends } = await db
    .from("mandate_spends")
    .select("amount_raw")
    .eq("mandate_id", mandateId);
  let spent = 0n;
  for (const s of spends ?? []) {
    try {
      spent += BigInt(s.amount_raw);
    } catch {
      /* skip */
    }
  }
  if (spent + amt > limit) {
    const remaining = limit - spent;
    return json(
      {
        ok: false,
        error: "exceeds_mandate",
        remaining_raw: remaining.toString(),
        short_by_raw: (amt - remaining).toString(),
        hint: "ask the grantor for more budget via /api/requests",
      },
      { status: 409 },
    );
  }

  const { data: row, error } = await db
    .from("mandate_spends")
    .insert({ mandate_id: mandateId, agent, amount_raw: amount, note, receipt_id: receiptId, signed_message: message, signature })
    .select("id, mandate_id, agent, amount_raw, note, receipt_id, created_at")
    .single();
  if (error || !row) return json({ ok: false, error: error?.message ?? "insert_failed" }, { status: 500 });

  const newSpent = spent + amt;
  return json({
    ok: true,
    spend: row,
    spent_raw: newSpent.toString(),
    remaining_raw: (limit - newSpent).toString(),
  });
}
