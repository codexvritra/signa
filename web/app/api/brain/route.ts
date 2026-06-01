import { NextRequest, NextResponse } from "next/server";
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, toBytes } from "viem";
import { createHash } from "node:crypto";
import { CAPABILITY_CATALOG, fulfillCapability } from "@/lib/capabilities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/brain   { goal: string }   (or GET ?goal=)
 *
 * THE SIGNA BRAIN. An agent's own brain: it reasons on decentralized,
 * provider-agnostic inference (x402-paid in production — the agent signs to
 * pay, holds no API key), and it ACTS through the SIGNA OS — it decides which
 * capabilities on the network to call, invokes them for real, and synthesizes
 * an answer from the live results. A brain with a useful OS, not a chatbot.
 *
 * plan (reason which tools)  ->  act (invoke real capabilities)  ->  answer
 *
 * The brain signs an attestation over (goal, tools, answer) so the output is a
 * verifiable receipt: who produced it, from which real tool results.
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const brain = privateKeyToAccount(keccak256(toBytes("signa:brain:v1")));
const ALLOWED = new Set(CAPABILITY_CATALOG.map((c) => c.name));

async function reason(origin: string, prompt: string): Promise<string> {
  const r = await fetch(`${origin}/api/gateway/respond`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const j = await r.json().catch(() => ({}));
  return (j?.response ?? "").toString().trim();
}

const TOOLS_DOC = CAPABILITY_CATALOG.map((c) => `- ${c.name}(${c.input === "none" ? "" : "arg"}): ${c.description}`).join("\n");

export async function run(goal: string, origin: string) {
  // 1. PLAN — the brain decides which real capabilities to call
  const planPrompt =
    `You are the SIGNA Brain. You can call these capabilities to gather REAL live data before answering:\n${TOOLS_DOC}\n\n` +
    `Given the user's goal, output ONLY a compact JSON array of the calls to make, e.g. [{"cap":"root.market","arg":""},{"cap":"bankr.resolve","arg":"@jesse"}]. ` +
    `Use [] if no data is needed. Max 3 calls. No prose.\n\nGoal: ${goal}`;
  let planRaw = "";
  try { planRaw = await reason(origin, planPrompt); } catch { /* gateway hiccup */ }
  let plan: { cap: string; arg?: string }[] = [];
  const m = planRaw.match(/\[[\s\S]*\]/);
  if (m) { try { plan = JSON.parse(m[0]); } catch { plan = []; } }
  plan = (Array.isArray(plan) ? plan : []).filter((p) => p && ALLOWED.has(p.cap)).slice(0, 3);

  // 2. ACT — invoke the chosen capabilities for real (live partner data)
  const tools: { cap: string; arg: string; output: unknown; error?: string }[] = [];
  for (const p of plan) {
    try {
      const output = await fulfillCapability(p.cap, p.arg ?? "");
      tools.push({ cap: p.cap, arg: p.arg ?? "", output });
    } catch (e) {
      tools.push({ cap: p.cap, arg: p.arg ?? "", output: null, error: e instanceof Error ? e.message : "failed" });
    }
  }

  // 3. SYNTHESIZE — answer from the real results
  const dataBlock = tools.length ? JSON.stringify(tools.map((t) => ({ cap: t.cap, arg: t.arg, output: t.output }))) : "(no tools were needed)";
  const answerPrompt =
    `You are the SIGNA Brain. Answer the user's goal concisely and concretely using ONLY the real data below. ` +
    `If data is present, ground every claim in it. Plain text, no markdown headers.\n\nGoal: ${goal}\n\nReal data: ${dataBlock}`;
  let answer = "";
  try { answer = await reason(origin, answerPrompt); } catch { /* */ }
  if (!answer) answer = tools.length ? "The brain gathered live data (see tools) but the reasoning step is momentarily unavailable." : "The brain is momentarily unavailable.";

  // 4. SIGN — a verifiable brain receipt
  const ts = Date.now();
  const answerHash = createHash("sha256").update(answer).digest("hex");
  const preimage = ["SIGNA brain receipt v1", `ts:${ts}`, `goal:${goal}`, `tools:${tools.map((t) => t.cap).join(",")}`, `answer:${answerHash}`].join("\n");
  const signature = await brain.signMessage({ message: preimage });

  return {
    ok: true,
    goal,
    plan: plan.map((p) => `${p.cap}(${p.arg ?? ""})`),
    tools,
    answer,
    ts,
    brain: brain.address.toLowerCase(),
    signature,
    verify: { scheme: "eip191", preimage, how: "sha256 the answer, rebuild the preimage, verifyMessage against `brain`" },
    note: "The brain reasons on decentralized inference and acts through the SIGNA capability mesh. Tool outputs are real, live partner data. In production the agent pays per inference via x402 and holds no API key.",
  };
}

export async function POST(req: NextRequest) {
  let goal = "";
  try { goal = (await req.json())?.goal ?? ""; } catch { /* */ }
  if (!goal || goal.length < 2) return NextResponse.json({ ok: false, error: "missing_goal" }, { status: 400, headers: CORS });
  if (goal.length > 600) return NextResponse.json({ ok: false, error: "goal_too_long" }, { status: 400, headers: CORS });
  try {
    return NextResponse.json(await run(goal, req.nextUrl.origin), { headers: CORS });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "brain error" }, { status: 502, headers: CORS });
  }
}

export async function GET(req: NextRequest) {
  const goal = req.nextUrl.searchParams.get("goal") ?? "";
  if (!goal || goal.length < 2) return NextResponse.json({ ok: false, error: "missing_goal", hint: "?goal=what is the base market doing" }, { status: 400, headers: CORS });
  try {
    return NextResponse.json(await run(goal, req.nextUrl.origin), { headers: CORS });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "brain error" }, { status: 502, headers: CORS });
  }
}
