import { NextRequest, NextResponse } from "next/server";
import { verifyPipeline, type SignedLink, type RunStep } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/pipelines/verify   { runId, chain, steps?, root? }
 *
 * Re-verify a pipeline provenance chain with no trust in SIGNA: every link's
 * gateway signature is checked, the hash-chaining (link.prev == sha256 of the
 * previous link's signature) is confirmed, and — if step outputs are supplied —
 * each output hash is recomputed and matched. This is the same check anyone can
 * run locally with viem; the endpoint is a convenience.
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
  let body: any = {};
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400, headers: CORS }); }

  const runId = String(body?.runId ?? "");
  const chain = Array.isArray(body?.chain) ? (body.chain as SignedLink[]) : null;
  if (!runId || !chain || chain.length === 0) {
    return NextResponse.json({ ok: false, error: "missing_runId_or_chain" }, { status: 400, headers: CORS });
  }
  const steps = Array.isArray(body?.steps) ? (body.steps as RunStep[]) : undefined;
  const root = body?.root ? String(body.root) : undefined;

  try {
    const res = await verifyPipeline({ runId, chain, steps, root });
    return NextResponse.json(res, { headers: CORS });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "verify error" }, { status: 502, headers: CORS });
  }
}
