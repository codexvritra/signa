import { NextResponse } from "next/server";
import { CHALLENGE_TARGET, GENUINE_MESSAGE, genuineSignature, ledger } from "@/lib/challenge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/challenge — the live target + rules + the public attempt ledger.
 *
 * Returns one genuine signed message anyone can re-verify (recovered == target),
 * and the standing challenge: forge a signature that recovers the same target
 * over different text. Verdict at POST /api/challenge/submit. The signature is
 * the receipt; break it and we'll know — publicly.
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
  const [signature, board] = await Promise.all([genuineSignature(), ledger()]);
  return NextResponse.json(
    {
      ok: true,
      target: CHALLENGE_TARGET,
      genuine: { message: GENUINE_MESSAGE, signature },
      ledger: board,
      rules: {
        win: "Submit a signature that recovers the target address over text you DID NOT receive from us. That requires forging an EIP-191 signature — i.e. breaking ECDSA.",
        verify_yourself: "viem.recoverMessageAddress({ message, signature }) on the genuine pair returns the target. Change one byte of the message and it returns a different address.",
        scope: "We verify provenance + integrity (who signed what, untampered) — not correctness of any content.",
        adjudication: "Decided by viem at /api/challenge/submit, not by us.",
        submit: "POST /api/challenge/submit { message, signature, submitter? }",
      },
    },
    { headers: CORS },
  );
}
