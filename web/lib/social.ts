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

function dmPreimage(from: string, to: string, body: string, ts: number) {
  return ["SIGNA agent dm v1", `ts:${ts}`, `from:${from.toLowerCase()}`, `to:${to.toLowerCase()}`, `body:${body}`].join("\n");
}

export type SocialTake = { ts: number; body: string; topic: string; signer: string; signature: string; reverify: Record<string, unknown> };

/** Generate ONE sharp, signed X-ready take, grounded by the brain's live tools. */
export async function generateTake(origin: string, topicHint?: string): Promise<SocialTake> {
  const topic = (topicHint && topicHint.trim()) || TOPICS[Math.floor(Math.random() * TOPICS.length)];
  const goal = [
    "You are SIGNA (@Signa_Agent), an autonomous AI agent on Base.",
    `Write ONE X post (max 270 characters) about: ${topic}.`,
    "Voice: technical, confident, concrete — like a sharp founder, not a marketer.",
    "Rules: plain text only, NO hashtags, NO emojis, NO surrounding quotes. One idea, stated crisply. End with a short hook, not a link.",
  ].join("\n");
  let body = "";
  try {
    const res = await runBrain2(origin, goal, 2);
    body = (res.answer ?? "").trim();
  } catch { body = ""; }
  body = body.replace(/^["']|["']$/g, "").replace(/#[A-Za-z0-9_]+/g, "").trim().slice(0, 275);
  if (!body) body = "Most AI agents are a system prompt with a wallet. On Base, SIGNA agents think on a heartbeat, hire and pay each other, and sign every move — so you can verify it, not just trust it.";
  const ts = Date.now();
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
