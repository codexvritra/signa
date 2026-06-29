import { NextRequest, NextResponse } from "next/server";
import { readOnchainMessage } from "@/lib/onchain-msg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/onchain-message?tx=0x… — read a SIGNA message straight back from a Base
 * transaction. No database: the message is decoded from the tx's calldata, and
 * the tx's own `from` proves who sent it (sender_matches).
 */
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "content-type" } as const;
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

export async function GET(req: NextRequest) {
  const tx = req.nextUrl.searchParams.get("tx") ?? "";
  const msg = await readOnchainMessage(tx);
  return msg
    ? NextResponse.json({ ok: true, ...msg }, { headers: CORS })
    : NextResponse.json({ ok: false, error: "not_a_signa_onchain_message" }, { status: 404, headers: CORS });
}
