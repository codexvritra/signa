import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { claimHandle, resolveHandle, handleForAddress } from "@/lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/mail — SIGNA Mail handles (you@signa) for wallet inboxes.
 *   GET ?handle=you            → resolve a handle to a wallet (sig re-verified)
 *   GET ?address=0x…           → the handle a wallet has claimed
 *   POST { handle, address, ts, signature } → claim a handle (wallet-signed)
 */
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type" } as const;
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

export async function GET(req: NextRequest) {
  const db = serverClient();
  const handle = req.nextUrl.searchParams.get("handle");
  const address = req.nextUrl.searchParams.get("address");
  if (handle) {
    const r = await resolveHandle(db, handle);
    return r
      ? NextResponse.json({ ok: true, handle: r.handle, address: r.address, email: `${r.handle}@signa` }, { headers: CORS })
      : NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: CORS });
  }
  if (address) {
    const h = await handleForAddress(db, address.toLowerCase());
    return NextResponse.json({ ok: true, handle: h, email: h ? `${h}@signa` : null }, { headers: CORS });
  }
  return NextResponse.json({ ok: false, error: "pass ?handle= or ?address=" }, { status: 400, headers: CORS });
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const r = await claimHandle(serverClient(), {
    handle: String(b.handle ?? ""),
    address: String(b.address ?? ""),
    ts: Number(b.ts ?? 0),
    signature: String(b.signature ?? ""),
  });
  return NextResponse.json({ ...r, ...(r.ok ? { email: `${r.handle}@signa` } : {}) }, { status: r.ok ? 200 : 400, headers: CORS });
}
