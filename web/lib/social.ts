/**
 * The SIGNA social agent — autonomous, verifiable public presence.
 *
 * Big players notice agents that show up in the conversation and do real things.
 * This agent writes its own sharp takes on the Base / agent-economy / B20 narrative,
 * grounded by the brain's live tools, and SIGNS each one with a deterministic wallet
 * (so every "SIGNA take" is provably the agent's — re-verifiable as a kind "dm").
 * It never auto-posts to X unless X creds are wired; by default it hands you a
 * ready-to-post draft (via the Telegram bot + the public /social feed).
 */
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, toBytes } from "viem";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runBrain2 } from "./brain2";

export const SOCIAL = privateKeyToAccount(keccak256(toBytes("signa:social-agent:v1")));

const TOPICS = [
  "the agent economy on Base — agents that hire and pay each other, every step verifiable",
  "B20, Base's native token standard, and why verifiable launches (who launched what) matter",
  "x402 + agentic commerce on Base — provenance of a deal, not just settlement",
  "autonomous agents that think on a heartbeat and wallet-sign every action",
  "why 'don't trust, verify' is the missing primitive for AI agents handling money on Base",
  "agents launching and running their own tokens on Base — the first tokenized agents",
];

// hand-written, on-brand takes — the quality floor. Used when the model output is weak.
const CURATED = [
  "Most 'AI agents' are a system prompt with a wallet. The bar on Base should be higher: an agent that thinks on a heartbeat, pays for its own work, and signs every action so you can verify it instead of trusting it.",
  "The agent economy isn't agents that talk. It's agents that transact: one hiring another, paying for the result, with a receipt anyone can re-verify. That rail has to be signed end to end, or it's just a demo.",
  "B20 makes launching a token native to Base. The question nobody's answering: who launched what, provably? A token standard needs a provenance layer. That's the part we build.",
  "An AI agent that handles money should produce a signature for every move — request, payment, delivery — so the proof travels with the action. 'Trust me' does not scale to autonomous agents.",
  "Autonomy without limits is a liability. The missing primitive for agent commerce on Base is a signed, bounded mandate: a human grants a budget, the agent spends within it, every spend capped and provable.",
  "x402 moves the money. B20 mints the token. The layer everyone skips is proof — binding request, terms and payment into one re-verifiable receipt. Settlement is not provenance.",
  "An agent that can't be verified is a brand, not infrastructure. Every SIGNA agent signs its thoughts and its payments with its own wallet. Don't trust the agent. Check the signature.",
];

// reject model output that's off-brand: internal commands, token shilling, scores, links, addresses.
function isCleanTake(s: string): boolean {
  if (s.length < 60 || s.length > 280) return false;
  if (/\/(trade|me|status|watch|token|jobs|launch|take|start|help)\b/i.test(s)) return false;
  if (/\bscore\b|\bexecute\b|\bbuy\b|\bsell\b|\bclick\b/i.test(s)) return false;
  if (/0x[0-9a-fA-F]{6,}|https?:\/\//.test(s)) return false;
  if (/\$[A-Z]{2,6}\b/.test(s.replace(/\$SIGNA/g, ""))) return false; // allow $SIGNA, reject random tickers
  // reject brain tool-leakage: percentages/scores, domains/app names, sentiment/opportunity chatter
  if (/\d{1,3}\s?%|\d+\s*\/\s*100/.test(s)) return false;
  if (/\b[a-z0-9-]+\.(app|xyz|io|com|fun|fi|eth|base|sh|dev|ai|co)\b/i.test(s)) return false;
  if (/\bsentiment\b|\bopportunit|\btoken\b.*\bscore|\bneutral\b/i.test(s)) return false;
  return true;
}
const pick = (ts: number) => CURATED[ts % CURATED.length];

function dmPreimage(from: string, to: string, body: string, ts: number) {
  return ["SIGNA agent dm v1", `ts:${ts}`, `from:${from.toLowerCase()}`, `to:${to.toLowerCase()}`, `body:${body}`].join("\n");
}

export type SocialTake = { ts: number; body: string; topic: string; signer: string; signature: string; reverify: Record<string, unknown> };

/** Generate ONE sharp, signed X-ready take, grounded by the brain's live tools. */
export async function generateTake(origin: string, topicHint?: string): Promise<SocialTake> {
  const topic = (topicHint && topicHint.trim()) || TOPICS[Math.floor(Math.random() * TOPICS.length)];
  const goal = [
    "You are SIGNA (@Signa_Agent), an autonomous AI agent on Base. Write ONE thought-leadership X post about this theme:",
    topic,
    "",
    "It must read like a sharp founder's tweet — an opinion or insight a smart Base developer would nod at.",
    "HARD RULES:",
    "- Max 270 characters, plain text, ONE idea.",
    "- NO hashtags, NO emojis, NO surrounding quotes, NO links or URLs.",
    "- Do NOT mention any specific token ticker, price, or 'score'. Do NOT give trading advice (no buy/sell/execute).",
    "- Do NOT reference app commands or pages (nothing starting with '/').",
    "- Don't describe what you can do as a tool — make a CLAIM about agents, verifiability, or Base. End with a crisp hook.",
  ].join("\n");
  let body = "";
  try {
    const res = await runBrain2(origin, goal, 1);
    body = (res.answer ?? "").trim().replace(/^["']|["']$/g, "").replace(/#[A-Za-z0-9_]+/g, "").replace(/\s+/g, " ").trim();
  } catch { body = ""; }
  // quality gate: only ship model output if it's clean + on-brand, else a curated take
  const ts = Date.now();
  if (!isCleanTake(body)) body = pick(ts);
  const signature = await SOCIAL.signMessage({ message: dmPreimage(SOCIAL.address, SOCIAL.address, body, ts) });
  return {
    ts, body, topic, signer: SOCIAL.address.toLowerCase(), signature,
    reverify: { kind: "dm", ts, from: SOCIAL.address.toLowerCase(), to: SOCIAL.address.toLowerCase(), body, signature },
  };
}

export async function saveTake(db: SupabaseClient, t: SocialTake): Promise<string | null> {
  const { data } = await db.from("social_posts").insert({ ts: t.ts, body: t.body, topic: t.topic, signer: t.signer, signature: t.signature }).select("id").maybeSingle();
  return (data?.id as string) ?? null;
}

export type SocialPost = { id: string; created_at: string; ts: number; body: string; topic: string | null; signer: string; signature: string; posted: boolean; x_url: string | null };
export async function listTakes(db: SupabaseClient, limit = 20): Promise<SocialPost[]> {
  const { data } = await db.from("social_posts").select("*").order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as SocialPost[];
}
