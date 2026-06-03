import { NextRequest, NextResponse } from "next/server";
import { runPipeline, type PipelineStep } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/pipelines/run   { steps: [{ cap, arg? }, ...] }
 *
 * Run a multi-provider capability pipeline. Each step invokes a capability
 * (built-in, registered, or on-chain) — its arg may reference earlier outputs
 * via {{prev}}, {{prev.field}}, or {{2.output.field}}. The run emits a single
 * wallet-signed, hash-chained PROVENANCE CHAIN proving which provider produced
 * what, in what order. Re-verify it at /api/pipelines/verify. Keyless.
 *
 * v1 runs free capabilities only; a priced step fails loudly (call it directly
 * via /api/capabilities/invoke with x402). Provenance, not correctness.
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

  const raw = Array.isArray(body?.steps) ? body.steps : [];
  if (raw.length < 1) return NextResponse.json({ ok: false, error: "no_steps", hint: 'POST { steps: [{ cap: "root.feargreed" }, { cap: "signa.reason", arg: "given {{prev.label}} sentiment, one line on Base" }] }' }, { status: 400, headers: CORS });
  if (raw.length > 6) return NextResponse.json({ ok: false, error: "too_many_steps", max: 6 }, { status: 400, headers: CORS });

  const steps: PipelineStep[] = [];
  for (const s of raw) {
    const cap = String(s?.cap ?? "").trim();
    if (!cap || cap.length > 60) return NextResponse.json({ ok: false, error: "invalid_step_cap" }, { status: 400, headers: CORS });
    const arg = s?.arg != null ? String(s.arg).slice(0, 2000) : "";
    steps.push({ cap, arg });
  }

  try {
    const run = await runPipeline(steps);
    return NextResponse.json(run, { headers: CORS });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "pipeline error" }, { status: 502, headers: CORS });
  }
}
