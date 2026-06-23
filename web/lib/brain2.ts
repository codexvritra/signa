/**
 * Brain 2.0 — the agentic reasoning engine.
 *
 * The v1 brain plans once, calls some tools, and answers. Brain 2.0 is a real
 * multi-step ReAct loop: it THINKS, picks ONE tool, OBSERVES the result, and
 * repeats — building toward the goal — until it decides it's done, then signs
 * the answer. It reasons on SIGNA's decentralized inference and acts through
 * the keyless capability mesh; every step is recorded in a verifiable trace.
 *
 * Pure orchestration over two primitives: inference (/api/gateway/respond) and
 * the capability mesh (lib/capabilities.fulfillCapability). The caller passes a
 * signer so the final answer is wallet-signed and re-verifiable.
 */
import { createHash } from "node:crypto";
import { fulfillCapability } from "./capabilities";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** The tools Brain 2.0 can use — reliable, keyless reads from the mesh. */
export const BRAIN2_TOOLS: { name: string; arg: string; about: string }[] = [
  { name: "root.market", arg: "-", about: "current Base market read — sentiment + top opportunity" },
  { name: "root.feargreed", arg: "-", about: "the crypto fear & greed index (0-100)" },
  { name: "token.price", arg: "<id e.g. ethereum, bitcoin, base:0x…>", about: "live token price in USD" },
  { name: "base.gas", arg: "-", about: "current Base gas price in gwei" },
  { name: "base.block", arg: "-", about: "latest Base block number + timestamp" },
  { name: "bankr.launches", arg: "-", about: "the latest token launches on Base" },
  { name: "defi.tvl", arg: "<slug e.g. aave, aerodrome>", about: "TVL for a DeFi protocol in USD" },
];
const TOOL_NAMES = new Set(BRAIN2_TOOLS.map((t) => t.name));

export type Brain2Step = {
  n: number;
  action: { tool: string; arg: string } | null;
  observation: string;
  final?: boolean;
};

export type Brain2Result = {
  goal: string;
  steps: Brain2Step[];
  tools_used: string[];
  answer: string;
};

async function infer(origin: string, prompt: string): Promise<string> {
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(`${origin}/api/gateway/respond`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const j = await r.json().catch(() => ({}));
      const t = (j?.response ?? "").toString().trim();
      if (t) return t;
    } catch {
      /* retry */
    }
  }
  return "";
}

function clip(v: unknown, n = 360): string {
  let s = typeof v === "string" ? v : JSON.stringify(v);
  if (s.length > n) s = s.slice(0, n) + "…";
  return s;
}

const toolList = BRAIN2_TOOLS.map((t) => `- ${t.name}(${t.arg})  — ${t.about}`).join("\n");

/**
 * Run the agentic loop. `maxSteps` tool calls before it must answer.
 */
export async function runBrain2(origin: string, goal: string, maxSteps = 3): Promise<Brain2Result> {
  const steps: Brain2Step[] = [];
  const obs: string[] = [];
  const used: string[] = [];

  for (let n = 1; n <= maxSteps; n++) {
    const prompt =
      `You are VERA, an autonomous agent on Base. Work toward this GOAL:\n"${goal}"\n\n` +
      `TOOLS (use exactly ONE per step):\n${toolList}\n\n` +
      `OBSERVATIONS SO FAR:\n${obs.length ? obs.join("\n") : "(none yet)"}\n\n` +
      `Reply with EXACTLY ONE line, no extra text:\n` +
      `  ACT: <tool> | <arg or ->     to use a tool\n` +
      `  FINAL: <one-paragraph answer that achieves the goal, citing the numbers you saw>   when you have enough\n`;
    const out = await infer(origin, prompt);
    const line = (out.split("\n").find((l) => /^\s*(ACT|FINAL)\s*:/i.test(l)) ?? out).trim();

    const mFinal = /^\s*FINAL\s*:\s*([\s\S]+)/i.exec(line);
    if (mFinal || !out) {
      const answer = (mFinal?.[1] ?? "").trim();
      if (answer) {
        steps.push({ n, action: null, observation: answer, final: true });
        return { goal, steps, tools_used: used, answer };
      }
      break; // no parseable final + no act → synthesize below
    }

    const mAct = /^\s*ACT\s*:\s*([a-z0-9._-]+)\s*(?:\|\s*([\s\S]+))?$/i.exec(line);
    let tool = mAct?.[1]?.trim() ?? "";
    let arg = (mAct?.[2] ?? "").trim();
    if (arg === "-" || arg.toLowerCase() === "none") arg = "";
    if (!TOOL_NAMES.has(tool)) {
      // model picked something invalid — record + continue (it will adapt or finalize)
      steps.push({ n, action: { tool: tool || "(unknown)", arg }, observation: "unavailable tool; choose from the list" });
      obs.push(`step ${n}: tried ${tool || "(unknown)"} → unavailable`);
      continue;
    }
    let observation: string;
    try {
      observation = clip(await fulfillCapability(tool, arg));
    } catch (e) {
      observation = `error: ${e instanceof Error ? e.message.slice(0, 80) : "failed"}`;
    }
    if (!used.includes(tool)) used.push(tool);
    steps.push({ n, action: { tool, arg }, observation });
    obs.push(`step ${n}: ${tool}${arg ? `(${arg})` : ""} → ${observation}`);
  }

  // synthesize a final answer from whatever was observed
  const synth = await infer(
    origin,
    `You are VERA. GOAL: "${goal}".\nYou gathered:\n${obs.join("\n") || "(no tool data)"}\n\nWrite a single concise paragraph that achieves the goal, citing the concrete numbers above. No preamble.`,
  );
  const answer = synth || (obs.length ? `Based on live data — ${obs.join("; ")}` : "I could not gather enough live data to answer confidently this run.");
  steps.push({ n: steps.length + 1, action: null, observation: answer, final: true });
  return { goal, steps, tools_used: used, answer };
}

export function answerHash(a: string): string {
  return sha256(a);
}
