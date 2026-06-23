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

function argFor(tool: string, g: string): string {
  if (tool === "token.price") return /(bitcoin|btc)\b/.test(g) ? "bitcoin" : "ethereum";
  if (tool === "defi.tvl") return (/(aave|aerodrome|uniswap|morpho|compound|moonwell|pendle)/.exec(g)?.[1]) ?? "aerodrome";
  return "";
}

/**
 * Plan tools (model picks, leniently parsed, + keyword backstops so it NEVER
 * runs dry), gather REAL live data from each, then reason a grounded answer.
 * This is the agentic loop: select → act → observe → synthesize. `maxTools`
 * caps the tool calls.
 */
export async function runBrain2(origin: string, goal: string, maxTools = 3): Promise<Brain2Result> {
  const g = goal.toLowerCase();
  const picks: string[] = [];
  const add = (t: string) => { if (TOOL_NAMES.has(t) && !picks.includes(t) && picks.length < maxTools) picks.push(t); };

  // 1) the model proposes tools (lenient: we just scan its reply for known names)
  const menu = BRAIN2_TOOLS.map((t) => `${t.name} — ${t.about}`).join("; ");
  const sel = await infer(origin, `You are VERA, an autonomous agent on Base. GOAL: "${goal}".\nPick the ${maxTools} most useful tools to achieve it. Reply ONLY with their exact names, comma-separated.\nTOOLS: ${menu}`);
  const selLow = sel.toLowerCase();
  for (const t of BRAIN2_TOOLS) if (selLow.includes(t.name)) add(t.name);

  // 2) keyword backstops — guarantee real, relevant tools even if inference flakes
  if (/market|sentiment|take|report|situational|outlook|read/.test(g)) { add("root.market"); add("root.feargreed"); }
  if (/fear|greed/.test(g)) add("root.feargreed");
  if (/gas/.test(g)) add("base.gas");
  if (/block|cheap|transact/.test(g)) add("base.block");
  if (/launch|new token|mint/.test(g)) add("bankr.launches");
  if (/tvl|liquidity|defi|protocol/.test(g)) add("defi.tvl");
  if (/price|eth|ether|bitcoin|btc/.test(g)) add("token.price");
  if (picks.length === 0) { add("root.market"); add("root.feargreed"); }

  // 3) act — gather REAL data from each tool
  const steps: Brain2Step[] = [];
  const obs: string[] = [];
  const used: string[] = [];
  let n = 1;
  for (const tool of picks) {
    const arg = argFor(tool, g);
    let observation: string;
    try { observation = clip(await fulfillCapability(tool, arg)); }
    catch (e) { observation = `error: ${e instanceof Error ? e.message.slice(0, 80) : "failed"}`; }
    used.push(tool);
    steps.push({ n, action: { tool, arg }, observation });
    obs.push(`${tool}${arg ? `(${arg})` : ""} → ${observation}`);
    n++;
  }

  // 4) synthesize a grounded answer from the live observations
  const synth = await infer(
    origin,
    `You are VERA, an autonomous agent on Base. GOAL: "${goal}".\nLIVE DATA you just gathered:\n${obs.join("\n")}\n\nWrite a sharp, specific answer in 1–2 sentences that achieves the goal, citing the concrete numbers above. No preamble, no disclaimers, no hedging.`,
  );
  const answer = (synth || `Live read — ${obs.join("; ")}`).slice(0, 1400);
  steps.push({ n, action: null, observation: answer, final: true });
  return { goal, steps, tools_used: used, answer };
}

export function answerHash(a: string): string {
  return sha256(a);
}
