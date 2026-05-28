import { NextResponse } from "next/server";
import { getPartnerReceipts } from "@/lib/receipts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/receipts
 *
 * Public ledger of wallet-signed activity per partner network. No auth.
 * 60-second in-memory cache so the page can be linked anywhere without
 * hammering the DB.
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET() {
  try {
    const receipts = await getPartnerReceipts();
    const totals = receipts.reduce(
      (acc, r) => ({
        rooms: acc.rooms + r.rooms,
        rooms_7d: acc.rooms_7d + r.rooms_7d,
        messages: acc.messages + r.messages,
        messages_7d: acc.messages_7d + r.messages_7d,
        unique_posters: acc.unique_posters + r.unique_posters,
      }),
      { rooms: 0, rooms_7d: 0, messages: 0, messages_7d: 0, unique_posters: 0 },
    );
    return NextResponse.json(
      {
        ok: true,
        generated_at: new Date().toISOString(),
        totals,
        partners: receipts,
      },
      { status: 200, headers: CORS },
    );
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500, headers: CORS },
    );
  }
}
