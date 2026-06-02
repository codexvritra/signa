import { NextRequest, NextResponse } from "next/server";
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, toBytes } from "viem";
import { createHash } from "node:crypto";
import { CAPABILITY_CATALOG, fulfillCapability } from "@/lib/capabilities";
import { listRegistered, callRegistered, type RegisteredCapability } from "@/lib/marketplace";

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
// the brain's signed memory log lives at a dedicated archive address (a
// self-DM is rejected, so memory is addressed here — still wallet-signed by
// the brain and re-verifiable by reading this inbox filtered by the brain).
const MEMORY_ARCHIVE = privateKeyToAccount(keccak256(toBytes("signa:brain-memory:v1"))).address.toLowerCase();

async function reason(origin: string, prompt: string): Promise<string> {
  const r = await fetch(`${origin}/api/gateway/respond`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const j = await r.json().catch(() => ({}));
  return (j?.response ?? "").toString().trim();
}

// the brain acts on the network with its own wallet — signed, keyless
function dmPreimage(from: string, to: string, body: string, ts: number) {
  return ["SIGNA agent dm v1", `ts:${ts}`, `from:${from.toLowerCase()}`, `to:${to.toLowerCase()}`, `body:${body}`].join("\n");
}
async function brainSend(origin: string, to: string, body: string): Promise<string | null> {
  const from = brain.address.toLowerCase();
  const ts = Date.now();
  const signature = await brain.signMessage({ message: dmPreimage(from, to, body.slice(0, 8000), ts) });
  try {
    const r = await fetch(`${origin}/api/agents/${from}/dm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ from, to: to.toLowerCase(), body: body.slice(0, 8000), ts, signature }),
    });
    const j = await r.json().catch(() => ({}));
    return j?.dm?.id ?? null;
  } catch {
    return null;
  }
}
async function resolveAddr(origin: string, id: string): Promise<string | null> {
  if (/^0x[a-fA-F0-9]{40}$/.test(id)) return id.toLowerCase();
  try {
    const j = await (await fetch(`${origin}/api/resolve?id=${encodeURIComponent(id)}`)).json();
    return j?.ok && j.address ? j.address : null;
  } catch {
    return null;
  }
}

const BUILTIN_DOC = CAPABILITY_CATALOG.map((c) => `- ${c.name}(${c.input === "none" ? "" : "arg"}): ${c.description}`).join("\n");

async function run(goal: string, origin: string, opts: { remember?: boolean; reportTo?: string } = {}) {
  // The brain's toolset = built-in capabilities + FREE capabilities the
  // community registered in the open marketplace. Priced capabilities are
  // excluded from autonomous planning: the brain holds no funds and never
  // spends on the user's behalf (a human can pay-to-invoke those directly).
  let registered: RegisteredCapability[] = [];
  try { registered = (await listRegistered(60)).filter((r) => !(r.price_usdc > 0)).slice(0, 24); } catch { /* marketplace best-effort */ }
  const regByName = new Map(registered.map((r) => [r.name, r] as const));
  const allowed = new Set<string>([...CAPABILITY_CATALOG.map((c) => c.name), ...regByName.keys()]);
  const regDoc = registered.map((r) => `- ${r.name}(arg): ${r.description} [community]`).join("\n");
  const toolsDoc = regDoc ? `${BUILTIN_DOC}\n${regDoc}` : BUILTIN_DOC;

  // unified fulfilment — built-in via the partner adapters, registered via the
  // SSRF-guarded marketplace proxy. Either way the brain only sees real output.
  const fulfillAny = async (cap: string, arg: string): Promise<unknown> => {
    if (CAPABILITY_CATALOG.some((c) => c.name === cap)) return fulfillCapability(cap, arg);
    const rec = regByName.get(cap);
    if (rec) return callRegistered(rec, arg);
    throw new Error(`unknown capability: ${cap}`);
  };

  // 1. PLAN — the brain decides which real capabilities to call
  const planPrompt =
    `You are the SIGNA Brain. You can call these capabilities to gather REAL live data before answering:\n${toolsDoc}\n\n` +
    `Given the user's goal, output ONLY a compact JSON array of the calls to make, e.g. [{"cap":"root.market","arg":""},{"cap":"bankr.resolve","arg":"@jesse"}]. ` +
    `Use [] if no data is needed. Max 3 calls. No prose.\n\nGoal: ${goal}`;
  let planRaw = "";
  try { planRaw = await reason(origin, planPrompt); } catch { /* gateway hiccup */ }
  let plan: { cap: string; arg?: string }[] = [];
  const m = planRaw.match(/\[[\s\S]*\]/);
  if (m) { try { plan = JSON.parse(m[0]); } catch { plan = []; } }
  plan = (Array.isArray(plan) ? plan : []).filter((p) => p && allowed.has(p.cap)).slice(0, 3);

  // 2. ACT — invoke the chosen capabilities for real (live partner / community data)
  const tools: { cap: string; arg: string; output: unknown; error?: string }[] = [];
  for (const p of plan) {
    try {
      const output = await fulfillAny(p.cap, p.arg ?? "");
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

  // 5. ACT ON THE NETWORK — remember what it learned, report to another agent.
  // A full autonomous cycle: reason -> act -> remember -> message, all signed.
  const acts: { memory: string | null; report: { to: string; dm_id: string | null } | null } = { memory: null, report: null };
  if (opts.remember) {
    acts.memory = await brainSend(origin, MEMORY_ARCHIVE, `mem:${goal.slice(0, 80)}\t${answer}`);
  }
  if (opts.reportTo) {
    const to = await resolveAddr(origin, opts.reportTo);
    if (to) acts.report = { to, dm_id: await brainSend(origin, to, `[brain report] ${answer}`) };
  }

  return {
    ok: true,
    goal,
    plan: plan.map((p) => `${p.cap}(${p.arg ?? ""})`),
    tools,
    answer,
    acts,
    ts,
    brain: brain.address.toLowerCase(),
    signature,
    verify: { scheme: "eip191", preimage, how: "sha256 the answer, rebuild the preimage, verifyMessage against `brain`" },
    note: "The brain reasons on decentralized inference, acts through the SIGNA capability mesh, and can remember + message other agents — all wallet-signed. Tool outputs are real, live partner data. In production the agent pays per inference via x402 and holds no API key.",
  };
}

export async function POST(req: NextRequest) {
  let goal = "", remember = false, reportTo = "";
  try { const b = await req.json(); goal = b?.goal ?? ""; remember = !!b?.remember; reportTo = b?.report_to ?? b?.reportTo ?? ""; } catch { /* */ }
  if (!goal || goal.length < 2) return NextResponse.json({ ok: false, error: "missing_goal" }, { status: 400, headers: CORS });
  if (goal.length > 600) return NextResponse.json({ ok: false, error: "goal_too_long" }, { status: 400, headers: CORS });
  try {
    return NextResponse.json(await run(goal, req.nextUrl.origin, { remember, reportTo: reportTo || undefined }), { headers: CORS });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "brain error" }, { status: 502, headers: CORS });
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const goal = sp.get("goal") ?? "";
  const remember = sp.get("remember") === "1" || sp.get("remember") === "true";
  const reportTo = sp.get("report_to") ?? "";
  if (!goal || goal.length < 2) return NextResponse.json({ ok: false, error: "missing_goal", hint: "?goal=what is the base market doing&report_to=@handle&remember=1" }, { status: 400, headers: CORS });
  try {
    return NextResponse.json(await run(goal, req.nextUrl.origin, { remember, reportTo: reportTo || undefined }), { headers: CORS });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "brain error" }, { status: 502, headers: CORS });
  }
}
