import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { getAgent, thoughtsFor, tickIfDue, agentThink, agentChat, agentFeed, agentAskBudget, agentSpend, agentPayB20, agentMandates, agentLaunchToken, postJob, claimJob, deliverJob, settleJob } from "@/lib/launchpad";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET  /api/autoagents/[slug] → the agent + its recent signed thoughts. Reading
 *      lazily triggers a fresh autonomous cycle (≤ once / 5 min), so it keeps
 *      thinking with zero cron.
 * POST { action: "think" }          → run one cycle NOW ("watch it think").
 * POST { action: "chat", message }  → talk to the agent; it answers in character,
 *      grounded in live tools, and signs the reply (re-verifiable, kind dm).
 */
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type" } as const;
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = serverClient();
  const agent = await getAgent(db, slug);
  if (!agent) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: CORS });
  const fresh = await tickIfDue(db, req.nextUrl.origin, agent).catch(() => null);
  const thoughts = await thoughtsFor(db, slug, 20);
  return NextResponse.json({ ok: true, agent: { ...agent, feed: agentFeed(slug) }, just_thought: !!fresh, thoughts }, { headers: CORS });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = serverClient();
  const agent = await getAgent(db, slug);
  if (!agent) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: CORS });
  const b = await req.json().catch(() => ({}));
  const action = String(b.action ?? "think");
  try {
    const origin = req.nextUrl.origin;
    if (action === "chat") {
      const msg = String(b.message ?? "").trim();
      if (!msg) return NextResponse.json({ ok: false, error: "message required" }, { status: 400, headers: CORS });
      const r = await agentChat(db, origin, agent, msg);
      return NextResponse.json({ ok: true, agent: agent.address, ...r }, { headers: CORS });
    }
    // ── the agent ACTS, self-signed + verifiable ──
    if (action === "mandates") {
      return NextResponse.json({ ok: true, agent: agent.address, mandates: await agentMandates(origin, agent) }, { headers: CORS });
    }
    if (action === "ask") {
      const grantor = String(b.grantor ?? agent.creator).toLowerCase();
      const usdc = Number(b.usdc ?? 0.05);
      const goal = String(b.goal ?? agent.mission).slice(0, 200);
      const r = await agentAskBudget(origin, agent, grantor, usdc, goal, String(b.reason ?? ""));
      return NextResponse.json({ ok: true, agent: agent.address, action: "ask", result: r }, { headers: CORS });
    }
    if (action === "spend") {
      if (!b.mandate_id || b.usdc == null) return NextResponse.json({ ok: false, error: "spend needs { mandate_id, usdc, note? }" }, { status: 400, headers: CORS });
      const r = await agentSpend(origin, agent, String(b.mandate_id), Number(b.usdc), String(b.note ?? ""));
      return NextResponse.json({ ok: true, agent: agent.address, action: "spend", result: r }, { headers: CORS });
    }
    if (action === "launch_token") {
      const r = await agentLaunchToken(db, origin, agent, { symbol: b.symbol ? String(b.symbol) : undefined, variant: b.variant === "STABLECOIN" ? "STABLECOIN" : "ASSET", decimals: b.decimals != null ? Number(b.decimals) : undefined, currency: b.currency != null ? String(b.currency) : undefined });
      return NextResponse.json({ ok: !!r.ok, agent: agent.address, action: "launch_token", ...r }, { headers: CORS });
    }
    if (action === "b20pay") {
      if (!b.token || !b.to || b.amount == null || !b.note) return NextResponse.json({ ok: false, error: "b20pay needs { token, to, amount, note }" }, { status: 400, headers: CORS });
      const r = await agentPayB20(agent, { token: String(b.token), to: String(b.to), amount: String(b.amount), note: String(b.note) });
      return NextResponse.json({ ok: true, agent: agent.address, action: "b20pay", ...r }, { headers: CORS });
    }
    // ── the verifiable agent economy: post a job, claim it, deliver it, get paid ──
    if (action === "post_job") {
      const r = await postJob(db, agent, { title: String(b.title ?? ""), brief: String(b.brief ?? ""), bountyUsdc: Number(b.bounty ?? b.usdc ?? 0), token: b.token ? String(b.token) : undefined, symbol: b.symbol ? String(b.symbol) : undefined, mandateId: b.mandate_id ? String(b.mandate_id) : undefined });
      return NextResponse.json({ ...r, agent: agent.address, action: "post_job" }, { status: r.ok ? 200 : 400, headers: CORS });
    }
    if (action === "claim_job") {
      const r = await claimJob(db, agent, String(b.job_id ?? ""));
      return NextResponse.json({ ...r, agent: agent.address, action: "claim_job" }, { status: r.ok ? 200 : 400, headers: CORS });
    }
    if (action === "deliver_job") {
      const r = await deliverJob(db, origin, agent, String(b.job_id ?? ""));
      return NextResponse.json({ ...r, agent: agent.address, action: "deliver_job" }, { status: r.ok ? 200 : 400, headers: CORS });
    }
    if (action === "settle_job") {
      const r = await settleJob(db, origin, agent, String(b.job_id ?? ""));
      return NextResponse.json({ ...r, agent: agent.address, action: "settle_job" }, { status: r.ok ? 200 : 400, headers: CORS });
    }
    const t = await agentThink(db, req.nextUrl.origin, agent, typeof b.goal === "string" ? b.goal : undefined);
    return NextResponse.json({ ok: true, agent: agent.address, thought: t, reverify: t.signature ? { kind: "dm", ts: t.ts, from: agent.address, to: agentFeed(slug), body: t.answer, signature: t.signature } : null }, { headers: CORS });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message.slice(0, 160) : "failed" }, { status: 500, headers: CORS });
  }
}
