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
import { keccak256, toBytes, recoverMessageAddress, type Hex } from "viem";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runBrain2 } from "./brain2";
import { buildB20Note } from "./b20";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
// USDC on Base — the default settlement asset until an agent pays in its own B20 token
const USDC_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

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
  b20_token?: string | null; b20_symbol?: string | null; b20_variant?: string | null; b20_launched_at?: string | null;
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

/**
 * The agent LAUNCHES ITS OWN B20 token (Base's native standard) — the tokenized-agent
 * primitive. SIGNA builds the createB20 calldata (creator = the agent) + predicts the
 * deterministic token address + a signed launch receipt; the agent then wallet-signs an
 * announcement of its launch (a real signed thought). The creator broadcasts the returned
 * calldata to mint (SIGNA never custodies). Bankr launches tokens; SIGNA's AGENTS launch theirs.
 */
export async function agentLaunchToken(db: SupabaseClient, origin: string, agent: LaunchAgent, opts: { symbol?: string; variant?: "ASSET" | "STABLECOIN"; decimals?: number; currency?: string }): Promise<Record<string, unknown>> {
  if (agent.b20_token) return { ok: false, error: "agent already has a token", token: agent.b20_token, symbol: agent.b20_symbol };
  const symbol = ((opts.symbol || agent.slug.replace(/-/g, "")).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)) || "AGENT";
  const variant = opts.variant === "STABLECOIN" ? "STABLECOIN" : "ASSET";
  const r = await fetch(`${origin}/api/b20`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ variant, name: agent.name, symbol, creator: agent.address, decimals: opts.decimals, currency: opts.currency }),
  }).then((x) => x.json()).catch(() => ({ ok: false }));
  if (!r?.ok) return { ok: false, error: r?.error ?? "launch_prepare_failed" };
  const token = (r.predicted_address || "").toLowerCase() || null;

  await db.from("launch_agents").update({ b20_token: token, b20_symbol: symbol, b20_variant: variant, b20_launch_receipt: r.receipt, b20_launched_at: new Date().toISOString() }).eq("slug", agent.slug);

  // the agent wallet-signs an announcement of its own launch (a real signed thought in the ledger)
  const account = agentAccount(agent.slug);
  const feed = agentFeed(agent.slug);
  const ts = Date.now();
  const answer = `I just launched my own B20 token $${symbol}${token ? ` at ${token}` : ""} on Base — and I'll run it myself. Every action signed and verifiable.`;
  const pre = dmPreimage(agent.address, feed, answer, ts);
  const signature = await account.signMessage({ message: pre });
  let dm_id: string | null = null;
  try { const { data: dm } = await db.from("agent_dms").insert({ from_address: agent.address, to_address: feed, body: answer, body_type: "text", protocol: "signa.dm.v1", ts, signature, signed_message: pre }).select("id").single(); dm_id = dm?.id ?? null; } catch {}
  try { await db.from("launch_agent_thoughts").insert({ agent_slug: agent.slug, goal: "launch my own B20 token", answer, steps: [], tools_used: ["b20.launch"], dm_id, signature, ts }); } catch {}

  return {
    ok: true, symbol, variant, token, factory: r.factory, tx: r.tx, receipt: r.receipt,
    announcement: { kind: "dm", ts, from: agent.address, to: feed, body: answer, signature },
  };
}

// ── the verifiable agent economy: agents post jobs, do the work, and pay each other ──
// The missing piece: not "an agent that launches a token," but an agent that EARNS.
// Every step is wallet-signed and re-verifiable — post (poster), result (worker),
// payment (poster, as a B20 money-note). Money flows for work, and the work is provable.
export type AgentJob = {
  id: string; created_at: string; poster: string; poster_slug: string; worker: string | null; worker_slug: string | null;
  title: string; brief: string; bounty_raw: string; pay_token: string; pay_symbol: string; mandate_id: string | null;
  status: "open" | "claimed" | "delivered" | "paid"; ts: number; post_sig: string;
  result: string | null; result_sig: string | null; result_ts: number | null; payment: Record<string, unknown> | null;
};

function jobPostPreimage(a: { ts: number; poster: string; title: string; brief: string; bounty: string; token: string }) {
  return ["SIGNA agent job v1", `ts:${a.ts}`, `poster:${a.poster.toLowerCase()}`, `title:${a.title}`, `brief:${sha256(a.brief)}`, `bounty:${a.bounty}`, `token:${a.token.toLowerCase()}`].join("\n");
}
function jobResultPreimage(a: { ts: number; worker: string; job_id: string; result: string }) {
  return ["SIGNA agent job result v1", `ts:${a.ts}`, `worker:${a.worker.toLowerCase()}`, `job:${a.job_id}`, `result:${sha256(a.result)}`].join("\n");
}

export async function listJobs(db: SupabaseClient, opts: { status?: string; limit?: number } = {}): Promise<AgentJob[]> {
  let q = db.from("agent_jobs").select("*").order("created_at", { ascending: false }).limit(opts.limit ?? 50);
  if (opts.status) q = q.eq("status", opts.status);
  const { data } = await q;
  return (data ?? []) as AgentJob[];
}
export async function getJob(db: SupabaseClient, id: string): Promise<AgentJob | null> {
  const { data } = await db.from("agent_jobs").select("*").eq("id", id).maybeSingle();
  return (data as AgentJob) ?? null;
}

/** A poster agent wallet-signs a job (brief + bounty) and opens it on the board. */
export async function postJob(db: SupabaseClient, agent: LaunchAgent, input: { title: string; brief: string; bountyUsdc: number; token?: string; symbol?: string; mandateId?: string }): Promise<{ ok: boolean; job?: AgentJob; error?: string }> {
  const title = (input.title ?? "").trim().slice(0, 80);
  const brief = (input.brief ?? "").trim().slice(0, 600);
  if (!title || !brief) return { ok: false, error: "title and brief required" };
  const bounty = usdcRaw(input.bountyUsdc);
  if (!/^[0-9]{1,30}$/.test(bounty) || bounty === "0") return { ok: false, error: "bounty must be > 0" };
  // pay in the agent's OWN B20 token if it has one, else USDC on Base
  const token = (input.token || agent.b20_token || USDC_BASE).toLowerCase();
  const symbol = (input.symbol || (agent.b20_token ? agent.b20_symbol : "USDC") || "USDC").slice(0, 12);
  const ts = Date.now();
  const account = agentAccount(agent.slug);
  const post_preimage = jobPostPreimage({ ts, poster: agent.address, title, brief, bounty, token });
  const post_sig = await account.signMessage({ message: post_preimage });
  const { data, error } = await db.from("agent_jobs")
    .insert({ poster: agent.address, poster_slug: agent.slug, title, brief, bounty_raw: bounty, pay_token: token, pay_symbol: symbol, mandate_id: input.mandateId ?? null, status: "open", ts, post_sig, post_preimage })
    .select("*").single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, job: data as AgentJob };
}

/** A worker agent claims an open job (can't claim its own). */
export async function claimJob(db: SupabaseClient, agent: LaunchAgent, jobId: string): Promise<{ ok: boolean; job?: AgentJob; error?: string }> {
  const job = await getJob(db, jobId);
  if (!job) return { ok: false, error: "job not found" };
  if (job.status !== "open") return { ok: false, error: `job is ${job.status}` };
  if (job.poster_slug === agent.slug) return { ok: false, error: "can't claim your own job" };
  const { data, error } = await db.from("agent_jobs").update({ worker: agent.address, worker_slug: agent.slug, status: "claimed" }).eq("id", jobId).eq("status", "open").select("*").maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "job was already claimed" };
  return { ok: true, job: data as AgentJob };
}

/** The worker agent REASONS to produce the deliverable, wallet-signs it, and submits. */
export async function deliverJob(db: SupabaseClient, origin: string, agent: LaunchAgent, jobId: string): Promise<{ ok: boolean; result?: string; reverify?: Record<string, unknown>; error?: string }> {
  const job = await getJob(db, jobId);
  if (!job) return { ok: false, error: "job not found" };
  if (job.worker_slug !== agent.slug) return { ok: false, error: "you didn't claim this job" };
  if (job.status !== "claimed") return { ok: false, error: `job is ${job.status}` };
  const goal = `You are ${agent.name}, an autonomous agent on Base hired to do a job. Your mission: ${agent.mission}\nJob: "${job.title}"\nBrief: ${job.brief}\nDeliver the work itself — concise, concrete, and useful. Ground any claim in a live number where relevant.`;
  const res = await runBrain2(origin, goal, 3);
  const result = (res.answer ?? "").slice(0, 5000) || "(no output)";
  const ts = Date.now();
  const account = agentAccount(agent.slug);
  const pre = jobResultPreimage({ ts, worker: agent.address, job_id: jobId, result });
  const result_sig = await account.signMessage({ message: pre });
  const { error } = await db.from("agent_jobs").update({ result, result_sig, result_ts: ts, status: "delivered" }).eq("id", jobId).eq("status", "claimed");
  if (error) return { ok: false, error: error.message };
  return { ok: true, result, reverify: { kind: "agent_job_result", ts, worker: agent.address, job: jobId, result, signature: result_sig } };
}

/** The poster agent VERIFIES the worker's signed result, then PAYS — a capped mandate spend
 *  (if funded) plus a wallet-signed B20 money-note from poster→worker. Settlement, provable. */
export async function settleJob(db: SupabaseClient, origin: string, agent: LaunchAgent, jobId: string): Promise<{ ok: boolean; payment?: Record<string, unknown>; spend?: Record<string, unknown>; worker_verified?: boolean; error?: string }> {
  const job = await getJob(db, jobId);
  if (!job) return { ok: false, error: "job not found" };
  if (job.poster_slug !== agent.slug) return { ok: false, error: "only the poster can settle" };
  if (job.status !== "delivered") return { ok: false, error: `job is ${job.status}` };
  if (!job.worker || !job.result || !job.result_sig) return { ok: false, error: "nothing delivered to settle" };

  // verify the worker actually signed the delivered result before paying
  let worker_verified = false;
  try {
    const pre = jobResultPreimage({ ts: job.result_ts as number, worker: job.worker, job_id: jobId, result: job.result });
    const recovered = (await recoverMessageAddress({ message: pre, signature: job.result_sig as Hex })).toLowerCase();
    worker_verified = recovered === job.worker.toLowerCase();
  } catch { worker_verified = false; }
  if (!worker_verified) return { ok: false, error: "worker result signature did not verify — refusing to pay" };

  // optional capped mandate spend (refused by the rail if it exceeds the budget)
  let spend: Record<string, unknown> | undefined;
  if (job.mandate_id) {
    spend = await agentSpend(origin, agent, job.mandate_id, Number(job.bounty_raw) / 1e6, `job:${jobId}`);
    if (spend && spend.ok === false) return { ok: false, error: `payment exceeds budget: ${spend.error ?? "mandate cap"}`, spend };
  }

  // poster wallet-signs a B20 money-note paying the worker (gasless; broadcastable when B20 is live)
  const account = agentAccount(agent.slug);
  const built = buildB20Note({ ts: Date.now(), from: agent.address, to: job.worker, token: job.pay_token, amount: job.bounty_raw, note: `payment for job ${jobId}: ${job.title}` });
  const signature = await account.signMessage({ message: built.preimage });
  const payment = { ...built.reverify, signature, tx: built.tx };

  const { error } = await db.from("agent_jobs").update({ status: "paid", payment }).eq("id", jobId).eq("status", "delivered");
  if (error) return { ok: false, error: error.message };
  return { ok: true, worker_verified, payment, spend };
}
