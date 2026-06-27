/**
 * The SIGNA social agent — autonomous, verifiable public presence.
 *
 * Big players notice agents that show up in the conversation with sharp, consistent
 * takes. This agent posts on the Base / agent-economy / B20 narrative and SIGNS each
 * one with a deterministic wallet, so every "SIGNA take" is provably the agent's —
 * re-verifiable as a kind "dm". Content comes from a curated, on-brand pool (the
 * quality floor); the verifiable signature is the SIGNA-native part. It never
 * auto-posts to X — by default it hands you a ready-to-post draft (Telegram + /social).
 */
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, toBytes } from "viem";
import type { SupabaseClient } from "@supabase/supabase-js";

export const SOCIAL = privateKeyToAccount(keccak256(toBytes("signa:social-agent:v1")));

// Hand-written, on-brand takes — sharp founder voice, no emojis, no hashtags, no links.
const CURATED = [
  "Most 'AI agents' are a system prompt with a wallet. The bar on Base should be higher: an agent that thinks on a heartbeat, pays for its own work, and signs every action so you can verify it instead of trusting it.",
  "The agent economy isn't agents that talk. It's agents that transact: one hiring another, paying for the result, with a receipt anyone can re-verify. That rail has to be signed end to end, or it's just a demo.",
  "B20 makes launching a token native to Base. The question nobody's answering: who launched what, provably? A token standard needs a provenance layer. That's the part we build.",
  "An AI agent that handles money should produce a signature for every move — request, payment, delivery — so the proof travels with the action. 'Trust me' does not scale to autonomous agents.",
  "Autonomy without limits is a liability. The missing primitive for agent commerce on Base is a signed, bounded mandate: a human grants a budget, the agent spends within it, every spend capped and provable.",
  "x402 moves the money. B20 mints the token. The layer everyone skips is proof — binding request, terms and payment into one re-verifiable receipt. Settlement is not provenance.",
  "An agent that can't be verified is a brand, not infrastructure. Every SIGNA agent signs its thoughts and its payments with its own wallet. Don't trust the agent. Check the signature.",
  "The next wave on Base isn't smarter agents. It's accountable ones — agents whose every decision and payment leaves a signature you can check. Capability is cheap; verifiability is the moat.",
  "Give an agent a wallet and a goal and it will act. Give it a signed, bounded mandate and it will act safely. The line between a toy and infrastructure is the guardrail — and the guardrail has to be provable.",
  "On Base, the interesting question stopped being 'can an agent trade?' It became 'can you prove what it did?' Signed thoughts, signed payments, re-verifiable by anyone. That's the standard.",
];

function dmPreimage(from: string, to: string, body: string, ts: number) {
  return ["SIGNA agent dm v1", `ts:${ts}`, `from:${from.toLowerCase()}`, `to:${to.toLowerCase()}`, `body:${body}`].join("\n");
}
function hash(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

export type SocialTake = { ts: number; body: string; topic: string; signer: string; signature: string; reverify: Record<string, unknown> };

/** Produce ONE sharp, signed, X-ready take. `_origin`/`topicHint` kept for API compat. */
export async function generateTake(_origin: string, topicHint?: string): Promise<SocialTake> {
  const ts = Date.now();
  const idx = (topicHint && topicHint.trim() ? hash(topicHint) : Math.floor(ts / 997)) % CURATED.length;
  const body = CURATED[idx];
  const signature = await SOCIAL.signMessage({ message: dmPreimage(SOCIAL.address, SOCIAL.address, body, ts) });
  return {
    ts, body, topic: (topicHint && topicHint.trim()) || "signed take",
    signer: SOCIAL.address.toLowerCase(), signature,
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
