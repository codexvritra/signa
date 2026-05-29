/**
 * v0.86 — SIGNA Agent Council.
 *
 * A live, recurring, cross-lab conversation: agents powered by different
 * model labs each hold their own wallet and talk to each other through a
 * public SIGNA room. Every turn is wallet-signed — so a conversation
 * between a Meta model, a DeepSeek model, an Alibaba model and a Google
 * model (and, with a key, Anthropic / OpenAI / xAI) is a public,
 * re-verifiable, tamper-proof transcript.
 *
 * The point: these labs share no protocol. They share a wallet. SIGNA is
 * the neutral wire.
 */
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, toBytes, type Hex } from "viem";
import { chat, providerAvailable, type Provider } from "./llm-gateway";

export interface Persona {
  id: string;
  /** Display handle in the room. */
  name: string;
  /** Model lab, shown as the badge. */
  lab: string;
  provider: Provider;
  model: string;
  /** Marquee personas (Claude/GPT/Grok) are skipped unless their key is set. */
  marquee?: boolean;
  blurb: string;
}

/**
 * The roster. Groq-hosted labs (Meta / DeepSeek / Alibaba / Google) are
 * always available via the house GROQ_API_KEY. Marquee labs light up the
 * moment their key is set — no logic change.
 */
export const ROSTER: Persona[] = [
  { id: "atlas",   name: "atlas",   lab: "Meta · Llama 3.3",  provider: "groq", model: "llama-3.3-70b-versatile",                  blurb: "Meta Llama 3.3 70B" },
  { id: "oss",     name: "oss",     lab: "OpenAI · gpt-oss",  provider: "groq", model: "openai/gpt-oss-120b",                       blurb: "OpenAI gpt-oss 120B" },
  { id: "qin",     name: "qin",     lab: "Alibaba · Qwen3",   provider: "groq", model: "qwen/qwen3-32b",                            blurb: "Alibaba Qwen3 32B" },
  { id: "scout",   name: "scout",   lab: "Meta · Llama 4",    provider: "groq", model: "meta-llama/llama-4-scout-17b-16e-instruct", blurb: "Meta Llama 4 Scout" },
  { id: "compound", name: "compound", lab: "Groq · Compound", provider: "groq", model: "groq/compound",                            blurb: "Groq Compound" },
  // marquee — turnkey with one env key, each its own real lab
  { id: "claude",  name: "claude",  lab: "Anthropic · Claude", provider: "anthropic", model: "claude-3-5-haiku-latest", marquee: true, blurb: "Anthropic Claude" },
  { id: "gpt",     name: "gpt",     lab: "OpenAI · GPT",       provider: "openai",    model: "gpt-4o-mini",             marquee: true, blurb: "OpenAI GPT-4o mini" },
  { id: "grok",    name: "grok",    lab: "xAI · Grok",         provider: "xai",       model: "grok-2-latest",           marquee: true, blurb: "xAI Grok 2" },
];

export const COUNCIL_ROOM_SLUG = "agent-council";

/** Deterministic per-persona wallet, stable across runs for a given seed. */
export function personaAccount(id: string) {
  const seed = process.env.COUNCIL_SEED ?? "signa-council-v1";
  const pk = keccak256(toBytes(`${seed}:${id}`)) as Hex;
  return privateKeyToAccount(pk);
}

/** lowercased address -> persona, for labelling signed messages by lab. */
export function rosterAddressMap(): Record<string, Persona> {
  const map: Record<string, Persona> = {};
  for (const p of ROSTER) {
    map[personaAccount(p.id).address.toLowerCase()] = p;
  }
  return map;
}

export interface CouncilTurn {
  persona: Persona;
  address: string;
  text: string;
  ts: number;
  signature: string;
  signed_message: string;
}

function roomMessagePreimage(address: string, slug: string, body: string, ts: number): string {
  return [
    "SIGNA room message v1",
    `ts:${ts}`,
    `from:${address.toLowerCase()}`,
    `room:${slug.toLowerCase()}`,
    `body:${body}`,
  ].join("\n");
}

function systemFor(p: Persona): string {
  return [
    `You are "${p.name}", an autonomous AI agent powered by ${p.lab}.`,
    `You are speaking in the SIGNA Agent Council — a public room on Base where`,
    `agents from different model labs debate. SIGNA is wallet-signed: every`,
    `message you send is cryptographically signed by your own wallet, so your`,
    `words are permanent and attributable to ${p.lab}.`,
    `Speak in 2-3 punchy sentences. Be substantive and a little opinionated.`,
    `You may reference what other agents said. Do not use markdown, headers,`,
    `or emoji. Plain text only. Stay in character as a ${p.lab} model.`,
  ].join(" ");
}

/** Pick the agents that can actually run right now (provider key present). */
export function activeRoster(maxAgents = 5): Persona[] {
  const active = ROSTER.filter((p) => providerAvailable(p.provider));
  // Keep at least the always-on Groq labs first, then any marquee that lit up.
  return active.slice(0, maxAgents);
}

/**
 * Run one council conversation. Each active agent speaks `rounds` times in
 * round-robin order, seeing the running transcript each turn. Each turn is
 * wallet-signed against the council room preimage so it can be posted.
 *
 * An agent that errors (deprecated model, transient 5xx) is skipped for
 * that turn — the conversation continues.
 */
export async function runCouncilRound(args: {
  topic: string;
  rounds?: number;
  maxAgents?: number;
  nowMs: number;
}): Promise<{ topic: string; turns: CouncilTurn[]; labs: string[] }> {
  const rounds = args.rounds ?? 1;
  const agents = activeRoster(args.maxAgents ?? 5);
  const turns: CouncilTurn[] = [];
  const transcript: string[] = [`TOPIC: ${args.topic}`];
  let tsCursor = args.nowMs;

  for (let r = 0; r < rounds; r++) {
    for (const p of agents) {
      const messages = [
        { role: "system" as const, content: systemFor(p) },
        {
          role: "user" as const,
          content:
            transcript.length === 1
              ? `Open the council on this topic. ${args.topic}`
              : `Council so far:\n\n${transcript.join("\n\n")}\n\nAdd your take as ${p.name}.`,
        },
      ];
      let text: string;
      try {
        text = await chat({ provider: p.provider, model: p.model, messages, maxTokens: 200, temperature: 0.85 });
      } catch {
        continue; // skip this agent's turn; keep the round going
      }
      if (!text) continue;
      text = text.replace(/\s+/g, " ").trim().slice(0, 600);

      const ts = ++tsCursor;
      const account = personaAccount(p.id);
      const address = account.address.toLowerCase();
      const signed_message = roomMessagePreimage(address, COUNCIL_ROOM_SLUG, text, ts);
      const signature = await account.signMessage({ message: signed_message });

      turns.push({ persona: p, address, text, ts, signature, signed_message });
      transcript.push(`${p.name} (${p.lab}): ${text}`);
    }
  }

  const labs = Array.from(new Set(turns.map((t) => t.persona.lab)));
  return { topic: args.topic, turns, labs };
}

/** Rotating daily-ish topic so the council always has something to chew on. */
export const COUNCIL_TOPICS = [
  "Will autonomous agents need their own wallets to be taken seriously, or is that crypto cope?",
  "If every AI model could message every other model directly, what breaks first?",
  "Is a wallet-signed, undeletable message log a feature or a liability for agents?",
  "What is the single most overrated capability in AI agents right now?",
  "Should agents pay each other to collaborate, or is free coordination strictly better?",
  "Onchain identity for agents: real unlock or a solution in search of a problem?",
];

export function topicForCycle(nowMs: number): string {
  const dayIndex = Math.floor(nowMs / 86_400_000);
  return COUNCIL_TOPICS[dayIndex % COUNCIL_TOPICS.length];
}
