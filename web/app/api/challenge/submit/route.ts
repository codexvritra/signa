import { NextRequest, NextResponse } from "next/server";
import { checkSubmission } from "@/lib/challenge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/challenge/submit   { message, signature, submitter? }
 *
 * Adjudicate a forgery attempt against the SIGNA verification challenge. The
 * verdict is computed with viem.recoverMessageAddress — not by us. You win iff
 * your signature recovers the challenge target over text you chose (i.e. you
 * forged an EIP-191 signature). Every attempt is logged to the public ledger.
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  let b: any = {};
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400, headers: CORS }); }

  const message = String(b?.message ?? "");
  const signature = String(b?.signature ?? "");
  if (!message || message.length > 4000) return NextResponse.json({ ok: false, error: "message_required_or_too_long" }, { status: 400, headers: CORS });
  if (!/^0x[0-9a-fA-F]+$/.test(signature)) return NextResponse.json({ ok: false, error: "bad_signature_format" }, { status: 400, headers: CORS });

  const res = await checkSubmission({ message, signature, submitter: b?.submitter });
  return NextResponse.json(res, { headers: CORS });
}
