import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { readOnchainMessage, recordOnchainMessage, onchainInbox } from "@/lib/onchain-msg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/onchain-message — onchain (wallet → wallet) messages written into Base tx calldata.
 *   GET ?tx=0x…    → read one message straight from the chain
 *   GET ?to=0x…    → the onchain inbox for a wallet (each row re-verified vs the chain)
 *   POST { tx }    → index a just-broadcast onchain message (verified on-chain first)
 * No database is the source of truth — the chain is. This just makes reading fast.
 */
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type" } as const;
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const tx = sp.get("tx");
  const to = sp.get("to");
  if (tx) {
    const msg = await readOnchainMessage(tx);
    return msg ? NextResponse.json({ ok: true, ...msg }, { headers: CORS }) : NextResponse.json({ ok: false, error: "not_a_signa_onchain_message" }, { status: 404, headers: CORS });
  }
  if (to) {
    const inbox = await onchainInbox(serverClient(), to.toLowerCase());
    return NextResponse.json({ ok: true, count: inbox.length, messages: inbox }, { headers: CORS });
  }
  return NextResponse.json({ ok: false, error: "pass ?tx= or ?to=" }, { status: 400, headers: CORS });
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const r = await recordOnchainMessage(serverClient(), String(b.tx ?? ""));
  return NextResponse.json(r, { status: r.ok ? 200 : 400, headers: CORS });
}
