import { NextRequest, NextResponse } from "next/server";
import { runBrain2, BRAIN2_TOOLS } from "@/lib/brain2";

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
  return NextResponse.json({ ok: true, ...res, engine: "brain2", tools_available: BRAIN2_TOOLS.map((t) => t.name) }, { headers: CORS });
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
