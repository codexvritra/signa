import { NextRequest, NextResponse } from "next/server";
import { runBrain2, signResult, BRAIN2_TOOLS, ALETHEIA, ALETHEIA_VERSION } from "@/lib/brain2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Brain 2.0 — the agentic reasoning engine.
 *
 * GET/POST { goal, max_steps? } → a multi-step ReAct run: the brain thinks,
 * picks one tool from the keyless capability mesh, observes, and repeats toward
 * the goal, then answers. Returns the full step trace + the answer. Reasons on
 * SIGNA's decentralized inference; acts through real, live capabilities.
 *
 * This powers VERA (/api/vera), SIGNA's flagship autonomous agent.
 */
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type" } as const;
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

async function handle(origin: string, goal: string, maxSteps: number) {
  if (!goal || goal.length < 3) {
    return NextResponse.json({ ok: false, error: "goal_required", tools: BRAIN2_TOOLS }, { status: 400, headers: CORS });
  }
  const res = await runBrain2(origin, goal.slice(0, 400), Math.min(Math.max(maxSteps, 1), 4));
  const receipt = await signResult(res);
  return NextResponse.json(
    {
      ok: true,
      model: ALETHEIA_VERSION,
      ...res,
      engine: "brain2",
      tools_available: BRAIN2_TOOLS.map((t) => t.name),
      receipt, // { model, version, ts, signature, answer_hash } — the model signed this answer
      reverify: { kind: "aletheia", ts: receipt.ts, goal: res.goal, tools: res.tools_used, answer: res.answer, signature: receipt.signature },
      signer: ALETHEIA,
    },
    { headers: CORS },
  );
}

export async function GET(req: NextRequest) {
  const goal = req.nextUrl.searchParams.get("goal") ?? "";
  const max = Number(req.nextUrl.searchParams.get("max_steps") ?? 3);
  return handle(req.nextUrl.origin, goal, max);
}
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  return handle(req.nextUrl.origin, String(b.goal ?? ""), Number(b.max_steps ?? 3));
}
