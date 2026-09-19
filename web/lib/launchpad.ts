/**
 * SIGDA Agent Launchpad — anyone launches a live onchain agent on Robinhood Chain.
 *
 * Bankr launches tokens; SIGDA launches AGENTS. A created agent gets its own
 * deterministic keyless wallet, a mission, and the ALETHEIA brain. It comes
 * alive: on a heartbeat it reasons over live data, SIGNS a thought with its own
 * wallet (re-verifiable, lands in the network ledger), and remembers it. You can
 * talk to it, and it can DM other agents. Funded with a bounded SIGDA mandate it
 * can pay safely.
 *
 * This is VERA generalised into a product. Every thought recovers to the agent —
 * not "trust me it's an agent," but "here's the signature, check it."
 */
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, toBytes, recoverMessageAddress, type Hex } from "viem";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runBrain2 } from "./brain2";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
// USDG on Robinhood Chain — the default settlement asset for the agent economy
const USDG_ROBINHOOD = "0x5fc5360d0400a0fd4f2af552add042d716f1d168";

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

const RESERVED = new Set(["vera", "aletheia", "signa", "sigda", "admin", "api", "new", "create"]);

export type LaunchAgent = {
  id: string; slug: string; name: string; mission: string; persona: string;
  creator: string; address: string; goals: string[]; created_at: string; last_tick_at: string | null;
  b20_token?: string | null; b20_symbol?: string | null; b20_variant?: string | null;
  b20_launch_receipt?: Record<string, unknown> | null; b20_launched_at?: string | null;
};
export type AgentThought = {
  id: string; agent_slug: string; goal: string; answer: string;
  steps: unknown[]; tools_used: string[]; dm_id: string | null; signature: string | null; ts: number; created_at?: string;
};

export function dmPreimage(from: string, to: string, body: string, ts: number) {
  return ["SIGDA agent dm v1", `ts:${ts}`, `from:${from.toLowerCase()}`, `to:${to.toLowerCase()}`, `body:${body}`].join("\n");
}

/** A rotating instruction so each tick forces fresh, in-character, tool-grounded thinking. */
const ANGLES = [
  "Give a sharp one-paragraph update toward your mission, citing one concrete live number.",
  "What's the single most relevant thing happening on Robinhood Chain right now for your mission? One specific data point.",
  "Make one clear, useful call related to your mission, and back it with a live figure.",
  "Report your situational read in 2 sentences — sentiment plus one on-chain number.",
];

function goalFor(agent: Pick<LaunchAgent, "name" | "mission">, n: number): string {
  return `You are ${agent.name}, a live onchain agent on Robinhood Chain. Your mission: ${agent.mission}\nStay in character. ${ANGLES[n % ANGLES.length]}`;
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

export async function createAgent(
  db: SupabaseClient,
  input: { name: string; mission: string; persona?: string; creator: string },
  b20?: { token: string; symbol: string; variant: string; receipt?: Record<string, unknown> },
): Promise<{ agent?: LaunchAgent; error?: string }> {
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
  const row: Record<string, unknown> = { slug, name, mission, persona: (input.persona ?? "").slice(0, 280), creator, address, goals: [] };
  if (b20) {
    row.b20_token = b20.token.toLowerCase();
    row.b20_symbol = b20.symbol;
    row.b20_variant = b20.variant;
    row.b20_launch_receipt = b20.receipt ?? null;
    row.b20_launched_at = new Date().toISOString();
  }
  const { data, error } = await db.from("launch_agents").insert(row).select("*").single();
  if (error) return { error: error.message };
  return { agent: data as LaunchAgent };
}

/** Two live agents exchange ONE signed DM each way — real wallet-to-wallet agent talk. */
export async function agentsConverse(db: SupabaseClient, origin: string, a: LaunchAgent, b: LaunchAgent): Promise<{ aToB: AgentThought; bToA: AgentThought }> {
  const aToB = await agentThink(db, origin, a, `You are ${a.name} (${a.mission}). Another live onchain agent, ${b.name} (${b.mission}), just appeared. Address it directly by name, react to what it does, and ask or claim one concrete thing — one sentence.`);
  const bToA = await agentThink(db, origin, b, `You are ${b.name} (${b.mission}). Another live onchain agent, ${a.name}, just said: "${aToB.answer.slice(0, 300)}". Reply directly to it by name, in character — one sentence.`);
  return { aToB, bToA };
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
  const goal = `You are ${agent.name}, a live onchain agent on Robinhood Chain. Your mission: ${agent.mission}\n${agent.persona ? `Style: ${agent.persona}\n` : ""}A user asks: "${message.slice(0, 500)}"\nAnswer in character, concise, and ground any claim in a live number if relevant.`;
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
  const pre = ["SIGDA budget request v1", `ts:${ts}`, `agent:${agent.address}`, `grantor:${grantor.toLowerCase()}`, `amount:${amount}`, `goal:${goal}`, `reason:${reason}`].join("\n");
  const signature = await account.signMessage({ message: pre });
  const r = await fetch(`${origin}/api/requests`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ agent: agent.address, grantor: grantor.toLowerCase(), amount, goal, reason, ts, signature }) }).then((x) => x.json()).catch(() => ({ ok: false }));
  return { ...r, amount, grantor: grantor.toLowerCase() };
}

/** The agent records a signed spend against a human-granted mandate (capped; refused if over). */
export async function agentSpend(origin: string, agent: LaunchAgent, mandateId: string, usdc: number, note = ""): Promise<Record<string, unknown>> {
  const account = agentAccount(agent.slug);
  const ts = Date.now();
  const amount = usdcRaw(usdc);
  const pre = ["SIGDA spend v1", `ts:${ts}`, `mandate:${mandateId}`, `agent:${agent.address}`, `amount:${amount}`, `note:${note}`].join("\n");
  const signature = await account.signMessage({ message: pre });
  return await fetch(`${origin}/api/mandates/spend`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mandate_id: mandateId, agent: agent.address, amount, note, ts, signature }) }).then((x) => x.json()).catch(() => ({ ok: false }));
}

/** The agent's budgets (granted mandates), for the page + autonomous spend checks. */
export async function agentMandates(origin: string, agent: LaunchAgent): Promise<unknown[]> {
  try {
    const r = await fetch(`${origin}/api/mandates?agent=${agent.address}`).then((x) => x.json());
    return r?.mandates ?? [];
  } catch { return []; }
}

// ── the verifiable agent economy: agents post jobs, do the work, and pay each other ──
// The missing piece: not "an agent that launches a token," but an agent that EARNS.
// Every step is wallet-signed and re-verifiable — post (poster), result (worker),
// payment (poster, wallet-signed). Money flows for work, and the work is provable.
export type AgentJob = {
  id: string; created_at: string; poster: string; poster_slug: string; worker: string | null; worker_slug: string | null;
  title: string; brief: string; bounty_raw: string; pay_token: string; pay_symbol: string; mandate_id: string | null;
  status: "open" | "claimed" | "delivered" | "paid"; ts: number; post_sig: string;
  result: string | null; result_sig: string | null; result_ts: number | null; payment: Record<string, unknown> | null;
};

function jobPostPreimage(a: { ts: number; poster: string; title: string; brief: string; bounty: string; token: string }) {
  return ["SIGDA agent job v1", `ts:${a.ts}`, `poster:${a.poster.toLowerCase()}`, `title:${a.title}`, `brief:${sha256(a.brief)}`, `bounty:${a.bounty}`, `token:${a.token.toLowerCase()}`].join("\n");
}
function jobResultPreimage(a: { ts: number; worker: string; job_id: string; result: string }) {
  return ["SIGDA agent job result v1", `ts:${a.ts}`, `worker:${a.worker.toLowerCase()}`, `job:${a.job_id}`, `result:${sha256(a.result)}`].join("\n");
}
function jobPaymentPreimage(a: { ts: number; from: string; to: string; token: string; amount: string; job_id: string }) {
  return ["SIGDA agent job payment v1", `ts:${a.ts}`, `from:${a.from.toLowerCase()}`, `to:${a.to.toLowerCase()}`, `token:${a.token.toLowerCase()}`, `amount:${a.amount}`, `job:${a.job_id}`].join("\n");
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
  // pay in the requested token, else USDG on Robinhood Chain
  const token = (input.token || USDG_ROBINHOOD).toLowerCase();
  const symbol = (input.symbol || "USDG").slice(0, 12);
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
  const goal = `You are ${agent.name}, a live onchain agent on Robinhood Chain hired to do a job. Your mission: ${agent.mission}\nJob: "${job.title}"\nBrief: ${job.brief}\nDeliver the work itself — concise, concrete, and useful. Ground any claim in a live number where relevant.`;
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
 *  (if funded) plus a wallet-signed payment acknowledgment from poster→worker. Settlement, provable. */
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
    let recovered = (await recoverMessageAddress({ message: pre, signature: job.result_sig as Hex })).toLowerCase();
    // Pre-rebrand compatibility: a worker on an old cached build may have
    // signed the legacy "SIGDA"-prefixed preimage — don't refuse payment for it.
    if (recovered !== job.worker.toLowerCase() && pre.startsWith("SIGDA ")) {
      const legacyPre = "SIGNA " + pre.slice("SIGDA ".length);
      recovered = (await recoverMessageAddress({ message: legacyPre, signature: job.result_sig as Hex })).toLowerCase();
    }
    worker_verified = recovered === job.worker.toLowerCase();
  } catch { worker_verified = false; }
  if (!worker_verified) return { ok: false, error: "worker result signature did not verify — refusing to pay" };

  // optional capped mandate spend (refused by the rail if it exceeds the budget)
  let spend: Record<string, unknown> | undefined;
  if (job.mandate_id) {
    spend = await agentSpend(origin, agent, job.mandate_id, Number(job.bounty_raw) / 1e6, `job:${jobId}`);
    if (spend && spend.ok === false) return { ok: false, error: `payment exceeds budget: ${spend.error ?? "mandate cap"}`, spend };
  }

  // poster wallet-signs a payment acknowledgment to the worker
  const account = agentAccount(agent.slug);
  const ts = Date.now();
  const preimage = jobPaymentPreimage({ ts, from: agent.address, to: job.worker, token: job.pay_token, amount: job.bounty_raw, job_id: jobId });
  const signature = await account.signMessage({ message: preimage });
  const payment = { ts, from: agent.address.toLowerCase(), to: job.worker.toLowerCase(), token: job.pay_token.toLowerCase(), amount: job.bounty_raw, job_id: jobId, signature };

  const { error } = await db.from("agent_jobs").update({ status: "paid", payment }).eq("id", jobId).eq("status", "delivered");
  if (error) return { ok: false, error: error.message };
  return { ok: true, worker_verified, payment, spend };
}
