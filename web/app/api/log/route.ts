import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { tick, latestCheckpoint, LOG_SIGNER, readLedger, ledgerCounts } from "@/lib/transparency";
import { readOnchainAnchor, logAnchorAddress } from "@/lib/log-anchor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/log — the head of the SIGNA transparency log (the network ledger).
 *
 * An append-only RFC 6962 Merkle log over EVERY signed artifact on the network
 * — messages, x402 deal receipts, mandate spends, delivery acks. The latest
 * checkpoint commits a Merkle root over all artifacts [0..tree_size), signed by
 * the log signer and chained to the previous root. Tampering with, dropping, or
 * reordering any covered artifact breaks its inclusion proof and the root no
 * longer matches — so the whole agent economy's history is tamper-EVIDENT, not
 * trusted. Reads tick the log lazily so it stays current with zero cron.
 *
 * Verify an artifact is in the log: GET /api/log/proof?id=<uuid>
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
  const onchain = await readOnchainAnchor().catch(() => null);
  const counts = await readLedger(db).then(ledgerCounts).catch(() => null);
  return NextResponse.json(
    {
      ok: true,
      log: "SIGNA transparency log — the network ledger (RFC 6962 Merkle over every signed artifact)",
      covers: ["dm", "receipt", "spend", "ack"],
      signer: LOG_SIGNER,
      checkpoint: cp,
      ledger: counts, // { dm, receipt, spend, ack } — what's committed in the tree
      anchor: {
        chain: "base",
        configured: !!logAnchorAddress(),
        onchain, // { seq, tree_size, root, anchored_at } once anchored on Base
        status: `${origin}/api/log/anchor`,
      },
      how: {
        inclusion: `${origin}/api/log/proof?id=<artifact uuid: dm / x402 receipt / spend / ack>`,
        consistency: `${origin}/api/log/consistency?first=<earlier tree_size>`,
        verify_checkpoint: `${origin}/api/verify  { kind:"log_checkpoint", seq, size, prev, root, ts, signature }`,
        rebuild:
          "fetch the ordered artifacts, leaf = SHA256(0x00 || 'SIGNA log leaf v2\\nkind:..\\nid:..\\nsig:..'), build the RFC 6962 tree, compare root to the signed checkpoint.",
      },
      basis:
        "Each artifact is independently signed; this proves the SET wasn't tampered. Every checkpoint, inclusion proof and consistency proof is reproducible offline — don't trust, verify.",
    },
    { headers: CORS },
  );
}
