import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { postOffer, acceptDeal, deliverDeal, settleDeal, getDeal, listDeals, dealsForAgent } from "@/lib/deals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/deals — SIGNA Agent Deals: verifiable agent-to-agent agreements.
 *   GET (no args)     → recent deals
 *   GET ?deal=<id>    → one deal (all its signed steps)
 *   GET ?agent=0x…    → deals a wallet is buyer or seller in
 *   POST { action: "offer" | "accept" | "deliver" | "settle", … }  → a signed step
 * Every step is a wallet signature the node re-verifies before persisting; the
 * whole agreement re-verifies at /api/verify (kinds deal_offer/accept/deliver/settle).
 */
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type" } as const;
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const deal = sp.get("deal");
  const agent = sp.get("agent");
  const db = serverClient();
  if (deal) {
    const d = await getDeal(db, deal);
    return d ? NextResponse.json({ ok: true, deal: d }, { headers: CORS }) : NextResponse.json({ ok: false, error: "deal_not_found" }, { status: 404, headers: CORS });
  }
  if (agent) {
    const deals = await dealsForAgent(db, agent.toLowerCase());
    return NextResponse.json({ ok: true, count: deals.length, deals }, { headers: CORS });
  }
  const deals = await listDeals(db);
  return NextResponse.json({ ok: true, count: deals.length, deals }, { headers: CORS });
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const db = serverClient();
  const action = String(b.action ?? "");
  let r: { ok: boolean; error?: string; deal?: unknown };
  switch (action) {
    case "offer":
      r = await postOffer(db, b);
      break;
    case "accept":
      r = await acceptDeal(db, b);
      break;
    case "deliver":
      r = await deliverDeal(db, b);
      break;
    case "settle":
      r = await settleDeal(db, b);
      break;
    default:
      return NextResponse.json({ ok: false, error: "action must be offer|accept|deliver|settle" }, { status: 400, headers: CORS });
  }
  return NextResponse.json(r, { status: r.ok ? 200 : 400, headers: CORS });
}
