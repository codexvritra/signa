import { NextRequest, NextResponse } from "next/server";
import { paidRecent, paidInbox, priceOf, SIGNA_PAID_ADDRESS } from "@/lib/signa-paid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/paid-message — pay-to-reach inboxes on the SignaPaidMessages contract.
 *   GET ?feed=recent     → latest paid messages across the contract
 *   GET ?inbox=0x…       → paid messages received by a wallet
 *   GET ?price=0x…       → the price (wei + ETH) to message a wallet
 * Read straight from the contract logs/state — the chain is the index.
 */
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "content-type" } as const;
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const price = sp.get("price");
  const inbox = sp.get("inbox");
  const feed = sp.get("feed");
  const limit = Math.min(Math.max(Number(sp.get("limit") || 50), 1), 100);

  if (price) {
    const p = await priceOf(price.toLowerCase());
    return NextResponse.json({ ok: true, contract: SIGNA_PAID_ADDRESS, address: price.toLowerCase(), price_wei: p.wei, price_eth: p.eth, priced: p.wei !== "0" }, { headers: CORS });
  }
  if (inbox) {
    const messages = await paidInbox(inbox.toLowerCase(), limit);
    return NextResponse.json({ ok: true, contract: SIGNA_PAID_ADDRESS, count: messages.length, messages }, { headers: CORS });
  }
  if (feed === "recent" || sp.has("recent")) {
    const messages = await paidRecent(limit);
    return NextResponse.json({ ok: true, contract: SIGNA_PAID_ADDRESS, count: messages.length, messages }, { headers: CORS });
  }
  return NextResponse.json({ ok: false, error: "pass ?feed=recent, ?inbox=0x…, or ?price=0x…" }, { status: 400, headers: CORS });
}
