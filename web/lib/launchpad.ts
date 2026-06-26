/**
 * SIGNA Agent Launchpad — anyone launches an autonomous agent on Base.
 *
 * Bankr launches tokens; SIGNA launches AGENTS. A created agent gets its own
 * deterministic keyless wallet, a mission, and the ALETHEIA brain. It comes
 * alive: on a heartbeat it reasons over live data, SIGNS a thought with its own
 * wallet (re-verifiable, lands in the network ledger), and remembers it. You can
 * talk to it, and it can DM other agents. Funded with a bounded SIGNA mandate it
 * can pay safely; with the B20 endpoints it can launch/pay/attest tokens.
 *
 * This is VERA generalised into a product. Every thought recovers to the agent —
 * not "trust me it's an agent," but "here's the signature, check it."
 */
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, toBytes } from "viem";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runBrain2 } from "./brain2";
import { buildB20Note } from "./b20";

/** Deterministic, keyless wallet for an agent — derived from its slug. */
export function agentAccount(slug: string) {
  return privateKeyToAccount(keccak256(toBytes(`signa:launch-agent:${slug}:v1`)));
}
export function agentFeed(slug: string): string {
  return privateKeyToAccount(keccak256(toBytes(`signa:launch-agent-feed:${slug}:v1`))).address.toLowerCase();
}

export function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
}

const RESERVED = new Set(["vera", "aletheia", "signa", "admin", "api", "new", "create"]);

export type LaunchAgent = {
  id: string; slug: string; name: string; mission: string; persona: string;
  creator: string; address: string; goals: string[]; created_at: string; last_tick_at: string | null;
};
export type AgentThought = {
  id: string; agent_slug: string; goal: string; answer: string;
  steps: unknown[]; tools_used: string[]; dm_id: string | null; signature: string | null; ts: number; created_at?: string;
};

function dmPreimage(from: string, to: string, body: string, ts: number) {
  return ["SIGNA agent dm v1", `ts:${ts}`, `from:${from.toLowerCase()}`, `to:${to.toLowerCase()}`, `body:${body}`].join("\n");
}

/** A rotating instruction so each tick forces fresh, in-character, tool-grounded thinking. */
const ANGLES = [
  "Give a sharp one-paragraph update toward your mission, citing one concrete live number.",
  "What's the single most relevant thing happening on Base right now for your mission? One specific data point.",
  "Make one clear, useful call related to your mission, and back it with a live figure.",
  "Report your situational read in 2 sentences — sentiment plus one on-chain number.",
];

function goalFor(agent: Pick<LaunchAgent, "name" | "mission">, n: number): string {
  return `You are ${agent.name}, an autonomous agent on Base. Your mission: ${agent.mission}\nStay in character. ${ANGLES[n % ANGLES.length]}`;
}

export async function getAgent(db: SupabaseClient, slug: string): Promise<LaunchAgent | null> {
  const { data } = await db.from("launch_agents").select("*").eq("slug", slug).maybeSingle();
  return (data as LaunchAgent) ?? null;
}

export async function listAgents(db: SupabaseClient, limit = 50): Promise<LaunchAgent[]> {
  const { data } = await db.from("launch_agents").select("*").order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as LaunchAgent[];
}

export async function thoughtsFor(db: SupabaseClient, slug: string, limit = 20): Promise<AgentThought[]> {
  const { data } = await db.from("launch_agent_thoughts").select("*").eq("agent_slug", slug).order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as AgentThought[];
}

export async function createAgent(db: SupabaseClient, input: { name: string; mission: string; persona?: string; creator: string }): Promise<{ agent?: LaunchAgent; error?: string }> {
  const name = (input.name ?? "").trim();
  const mission = (input.mission ?? "").trim();
  const creator = (input.creator ?? "").toLowerCase();
  if (!name || name.length > 40) return { error: "name required (≤40 chars)" };
  if (!mission || mission.length > 280) return { error: "mission required (≤280 chars)" };
  if (!/^0x[a-f0-9]{40}$/.test(creator)) return { error: "creator must be a wallet (0x…40)" };
  const slug = slugify(name);
  if (!slug || RESERVED.has(slug)) return { error: "pick a different name" };
  const existing = await getAgent(db, slug);
  if (existing) return { error: `the handle "${slug}" is taken` };

  const address = agentAccount(slug).address.toLowerCase();
  const { data, error } = await db.from("launch_agents")
    .insert({ slug, name, mission, persona: (input.persona ?? "").slice(0, 280), creator, address, goals: [] })
    .select("*").single();
  if (error) return { error: error.message };
  return { agent: data as LaunchAgent };
}

/** Run ONE autonomous cycle for an agent: reason → sign a thought → ledger + memory. */
export async function agentThink(db: SupabaseClient, origin: string, agent: LaunchAgent, goalOverride?: string): Promise<AgentThought> {
  const { count } = await db.from("launch_agent_thoughts").select("id", { count: "exact", head: true }).eq("agent_slug", agent.slug);
  const goal = goalOverride?.trim() || goalFor(agent, count ?? 0);

  const res = await runBrain2(origin, goal, 3);
  const answer = (res.answer ?? "").slice(0, 3000);
  const account = agentAccount(agent.slug);
  const feed = agentFeed(agent.slug);
  const ts = Date.now();
  const signedMessage = dmPreimage(agent.address, feed, answer, ts);
  const signature = await account.signMessage({ message: signedMessage });

  let dm_id: string | null = null;
  try {
    const { data: dm } = await db.from("agent_dms")
      .insert({ from_address: agent.address, to_address: feed, body: answer, body_type: "text", protocol: "signa.dm.v1", ts, signature, signed_message: signedMessage })
      .select("id").single();
    dm_id = dm?.id ?? null;
  } catch { /* still record the thought */ }

  const { data: row } = await db.from("launch_agent_thoughts")
    .insert({ agent_slug: agent.slug, goal, answer, steps: res.steps, tools_used: res.tools_used, dm_id, signature, ts })
    .select("*").single();
  await db.from("launch_agents").update({ last_tick_at: new Date().toISOString() }).eq("slug", agent.slug);

  return (row as AgentThought) ?? { id: "", agent_slug: agent.slug, goal, answer, steps: res.steps, tools_used: res.tools_used, dm_id, signature, ts };
}

/** Lazy heartbeat: think at most once per `minMs` on read, so agents stay alive with traffic. */
export async function tickIfDue(db: SupabaseClient, origin: string, agent: LaunchAgent, minMs = 5 * 60_000): Promise<AgentThought | null> {
  if (agent.last_tick_at && Date.now() - new Date(agent.last_tick_at).getTime() < minMs) return null;
  try { return await agentThink(db, origin, agent); } catch { return null; }
}

/** Talk to the agent: it answers in character, grounded in live tools, and signs the reply. */
export async function agentChat(db: SupabaseClient, origin: string, agent: LaunchAgent, message: string): Promise<{ answer: string; signature: string; signer: string; reverify: Record<string, unknown> }> {
  const goal = `You are ${agent.name}, an autonomous agent on Base. Your mission: ${agent.mission}\n${agent.persona ? `Style: ${agent.persona}\n` : ""}A user asks: "${message.slice(0, 500)}"\nAnswer in character, concise, and ground any claim in a live number if relevant.`;
  const res = await runBrain2(origin, goal, 3);
  const answer = (res.answer ?? "").slice(0, 2000);
  const account = agentAccount(agent.slug);
  const ts = Date.now();
  const preimage = dmPreimage(agent.address, agent.address, answer, ts); // self-signed reply, re-verifiable as a dm
  const signature = await account.signMessage({ message: preimage });
  return { answer, signature, signer: agent.address, reverify: { kind: "dm", ts, from: agent.address, to: agent.address, body: answer, signature } };
}

// ── the agent ACTS (not just thinks) — every action self-signed + verifiable ──
const usdcRaw = (usdc: number | string) => String(Math.round(Number(usdc) * 1e6));

/** The agent wallet-signs a request for a starter budget from a human ("agent asks for money"). */
export async function agentAskBudget(origin: string, agent: LaunchAgent, grantor: string, usdc: number, goal: string, reason = ""): Promise<Record<string, unknown>> {
  const account = agentAccount(agent.slug);
  const ts = Date.now();
  const amount = usdcRaw(usdc);
  const pre = ["SIGNA budget request v1", `ts:${ts}`, `agent:${agent.address}`, `grantor:${grantor.toLowerCase()}`, `amount:${amount}`, `goal:${goal}`, `reason:${reason}`].join("\n");
  const signature = await account.signMessage({ message: pre });
  const r = await fetch(`${origin}/api/requests`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ agent: agent.address, grantor: grantor.toLowerCase(), amount, goal, reason, ts, signature }) }).then((x) => x.json()).catch(() => ({ ok: false }));
  return { ...r, amount, grantor: grantor.toLowerCase() };
}

/** The agent records a signed spend against a human-granted mandate (capped; refused if over). */
export async function agentSpend(origin: string, agent: LaunchAgent, mandateId: string, usdc: number, note = ""): Promise<Record<string, unknown>> {
  const account = agentAccount(agent.slug);
  const ts = Date.now();
  const amount = usdcRaw(usdc);
  const pre = ["SIGNA spend v1", `ts:${ts}`, `mandate:${mandateId}`, `agent:${agent.address}`, `amount:${amount}`, `note:${note}`].join("\n");
  const signature = await account.signMessage({ message: pre });
  return await fetch(`${origin}/api/mandates/spend`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mandate_id: mandateId, agent: agent.address, amount, note, ts, signature }) }).then((x) => x.json()).catch(() => ({ ok: false }));
}

/** The agent autonomously pays with a verifiable B20 money-note (it's the payer; signs the note). */
export async function agentPayB20(agent: LaunchAgent, args: { token: string; to: string; amount: string; note: string }): Promise<Record<string, unknown>> {
  const account = agentAccount(agent.slug);
  const built = buildB20Note({ ts: Date.now(), from: agent.address, to: args.to, token: args.token, amount: String(args.amount), note: args.note });
  const signature = await account.signMessage({ message: built.preimage });
  return { memo: built.memo, tx: built.tx, signature, reverify: { ...built.reverify, signature } };
}

/** The agent's budgets (granted mandates), for the page + autonomous spend checks. */
export async function agentMandates(origin: string, agent: LaunchAgent): Promise<unknown[]> {
  try {
    const r = await fetch(`${origin}/api/mandates?agent=${agent.address}`).then((x) => x.json());
    return r?.mandates ?? [];
  } catch { return []; }
}
