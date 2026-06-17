import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { authorizeBearer } from "@/lib/secret-auth";
import { anchorStatus, anchorLatest } from "@/lib/log-anchor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET  /api/log/anchor  — is the transparency log's head pinned on Base?
 *                         Reports the latest DB checkpoint vs the on-chain
 *                         anchor (SignaLogAnchor) and whether they agree.
 * POST /api/log/anchor  — broadcast an anchor for the latest checkpoint
 *                         (guarded by CRON_SECRET; needs the contract deployed
 *                         + the log-signer funded for gas).
 *
 * On-chain anchoring settles the log's history on Base: a later off-chain root
 * that contradicts an anchored one is provably a fork. Degrades to
 * { configured:false } until SIGNA_LOG_ANCHOR_ADDRESS is set.
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET() {
  const status = await anchorStatus(serverClient());
  return NextResponse.json({ ok: true, ...status }, { headers: CORS });
}

export async function POST(req: NextRequest) {
  if (!authorizeBearer(req, "CRON_SECRET")) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: CORS });
  }
  const res = await anchorLatest(serverClient());
  return NextResponse.json(res, { status: res.ok ? 200 : 400, headers: CORS });
}
