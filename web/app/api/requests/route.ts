import { NextRequest, NextResponse } from "next/server";
import { serverClient, supabase } from "@/lib/supabase";
import { verifySignedMessage } from "@/lib/verify-signature";
import { budgetRequestPreimage } from "@/lib/mandate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/requests — an agent wallet-signs a request for more budget from its
 * grantor: "I need $Z more to finish goal G." This is the primitive the Base
 * agentic-commerce debate says is missing ("no agent has ever asked me for
 * money"). The signature recovers to the agent, so the ask is provably from it.
 * The human funds it by issuing a new mandate. POST to ask; GET for the inbox
 * (optionally ?grantor=).
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
const json = (b: unknown, i?: ResponseInit) =>
  NextResponse.json(b, { ...i, headers: { ...(i?.headers ?? {}), ...CORS } });

export async function GET(req: NextRequest) {
  const grantor = (req.nextUrl.searchParams.get("grantor") ?? "").toLowerCase();
  let q = supabase
    .from("budget_requests")
    .select("id, agent, grantor, amount_raw, goal, reason, status, signed_message, signature, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  if (/^0x[a-f0-9]{40}$/.test(grantor)) q = q.eq("grantor", grantor);
  const { data, error } = await q;
  if (error) return json({ ok: false, error: error.message }, { status: 500 });
  return json({ ok: true, requests: data ?? [] });
}

export async function POST(req: NextRequest) {
  let b: any;
  try {
    b = await req.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const agent = String(b.agent ?? "").toLowerCase();
  const grantor = String(b.grantor ?? "").toLowerCase();
  const amount = String(b.amount ?? "");
  const goal = b.goal != null ? String(b.goal).slice(0, 280) : "";
  const reason = b.reason != null ? String(b.reason).slice(0, 280) : "";
  const ts = Number(b.ts ?? 0);
  const signature = String(b.signature ?? "");

  if (!/^0x[a-f0-9]{40}$/.test(agent)) return json({ ok: false, error: "invalid_agent" }, { status: 400 });
  if (!/^0x[a-f0-9]{40}$/.test(grantor)) return json({ ok: false, error: "invalid_grantor" }, { status: 400 });
  let amt: bigint;
  try {
    amt = BigInt(amount);
  } catch {
    return json({ ok: false, error: "invalid_amount" }, { status: 400 });
  }
  if (amt <= 0n) return json({ ok: false, error: "amount_must_be_positive" }, { status: 400 });

  const message = budgetRequestPreimage({ ts, agent, grantor, amount, goal, reason });
  const v = await verifySignedMessage({ expectedAddress: agent, message, signature, ts });
  if (!v.ok) return json({ ok: false, error: v.reason }, { status: 401 });

  const { data, error } = await serverClient()
    .from("budget_requests")
    .insert({ agent, grantor, amount_raw: amount, goal, reason, status: "pending", signed_message: message, signature })
    .select("id, agent, grantor, amount_raw, goal, reason, status, created_at")
    .single();
  if (error || !data) return json({ ok: false, error: error?.message ?? "insert_failed" }, { status: 500 });
  return json({ ok: true, request: data });
}
