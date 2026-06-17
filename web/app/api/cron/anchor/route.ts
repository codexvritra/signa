import { NextRequest, NextResponse } from "next/server";
import { authorizeBearer } from "@/lib/secret-auth";
import { serverClient } from "@/lib/supabase";
import { anchorLatest } from "@/lib/log-anchor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/anchor — once a day, pin the transparency log's latest
 * checkpoint root to Base (SignaLogAnchor). No-op + harmless when the anchor
 * contract isn't configured or the log signer isn't funded. Guarded by
 * CRON_SECRET. One cheap tx/day keeps the on-chain history current.
 */
export async function GET(req: NextRequest) {
  if (!authorizeBearer(req, "CRON_SECRET")) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const res = await anchorLatest(serverClient());
  return NextResponse.json(res);
}
