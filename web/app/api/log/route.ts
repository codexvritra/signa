import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { tick, latestCheckpoint, LOG_SIGNER } from "@/lib/transparency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/log — the head of the SIGNA transparency log.
 *
 * An append-only RFC 6962 Merkle log over every wallet-signed message. The
 * latest checkpoint commits a Merkle root over all messages [0..tree_size),
 * signed by the log signer and chained to the previous root. Tampering with,
 * dropping, or reordering any covered message breaks its inclusion proof and
 * the root no longer matches — so the central store is tamper-EVIDENT, not
 * trusted. Reads tick the log lazily so it stays current with zero cron.
 *
 * Verify a message is in the log:   GET /api/log/proof?message=<uuid>
 * Verify the log is append-only:    GET /api/log/consistency?first=<size>
 * Re-verify a checkpoint signature:  POST /api/verify { kind:"log_checkpoint", ... }
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const db = serverClient();
  let cp = null;
  try {
    cp = await tick(db, Date.now()); // bootstrap + advance on read
  } catch {
    cp = await latestCheckpoint(db).catch(() => null);
  }
  const origin = req.nextUrl.origin;
  return NextResponse.json(
    {
      ok: true,
      log: "SIGNA transparency log (RFC 6962 Merkle, over the signed message layer)",
      signer: LOG_SIGNER,
      checkpoint: cp,
      how: {
        inclusion: `${origin}/api/log/proof?message=<dm uuid>`,
        consistency: `${origin}/api/log/consistency?first=<earlier tree_size>`,
        verify_checkpoint: `${origin}/api/verify  { kind:"log_checkpoint", seq, size, prev, root, ts, signature }`,
        rebuild:
          "fetch the ordered messages (/api/agents/* or /api/dm/thread), leaf = SHA256(0x00 || 'SIGNA log leaf v1\\nid:..\\nfrom:..\\nto:..\\nts:..\\nbody:sha256(body)\\nsig:..'), build the RFC6962 tree, compare root to the signed checkpoint.",
      },
      basis:
        "Signatures prove who wrote each message; this proves the SET wasn't tampered. Every checkpoint, inclusion proof and consistency proof is reproducible offline — don't trust, verify.",
    },
    { headers: CORS },
  );
}
