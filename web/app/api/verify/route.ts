import { NextRequest, NextResponse } from "next/server";
import { verifyArtifact, VERIFY_KINDS, type VerifyInput } from "@/lib/verify-artifact";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/verify   { kind, ...fields, signature }
 * GET  /api/verify   (schema)
 *
 * The universal verifier for the SIGNA message layer. Re-verify ANY wallet-
 * signed SIGNA artifact and RECOVER the signer, with no trust in SIGNA:
 *
 *   kind: "dm"            { ts, from, to, body, in_reply_to?, signature }
 *   kind: "room"          { ts, from, room, body, in_reply_to?, signature }
 *   kind: "capability"    { cap, input, provider, ts, output|output_hash, signature }
 *   kind: "brain"         { ts, goal, tools, answer|answer_hash, signature }
 *   kind: "pipeline_link" { runId, step, cap, provider, input_hash, output_hash, prev, ts, signature }
 *   kind: "raw"           { preimage, expected?, signature }
 *
 * Returns the recovered signer, the expected signer (where SIGNA knows it),
 * whether they match, and the exact preimage so you can re-run it locally with
 * viem.verifyMessage / recoverMessageAddress. The signature IS the receipt.
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      verifier: "SIGNA universal message verifier",
      how: "POST { kind, ...fields, signature }. Re-verifies the EIP-191 signature and recovers the signer. No trust in SIGNA — the same check runs locally with viem.recoverMessageAddress over the returned preimage.",
      kinds: VERIFY_KINDS,
    },
    { headers: CORS },
  );
}

export async function POST(req: NextRequest) {
  let body: VerifyInput = {};
  try { body = (await req.json()) as VerifyInput; } catch { return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400, headers: CORS }); }
  const res = await verifyArtifact(body);
  const status = res.ok ? 200 : 400;
  return NextResponse.json(res, { status, headers: CORS });
}
