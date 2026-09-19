import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { getAgent, thoughtsFor, tickIfDue, agentThink, recordThought, shareFinding, agentChat, agentFeed, agentAskBudget, agentSpend, agentMandates, postJob, claimJob, deliverJob, settleJob, type LaunchAgent } from "@/lib/launchpad";
import { obsessionFor } from "@/lib/obsession";
import { fetchObsessionPage, reflectOnPage, browseInteractive } from "@/lib/browse";

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
    // ── real web reading. Tries a live interactive session first (real
    // navigation + a real click-through, like 9e9.world); falls back to the
    // cheap session-less fetch if the account/plan doesn't support sessions
    // or the session errors out, so this endpoint stays reliable either way.
    if (action === "browse") {
      const obsession = obsessionFor(agent.address);
      let t; let mode: string; let source: string; let fallback_reason: string | undefined;
      try {
        const session = await browseInteractive(agent.name, obsession);
        t = await recordThought(db, agent, `browsed from ${obsession}`, session.answer, session.trace, ["browserbase.session"]);
        mode = "interactive"; source = session.finalUrl;
      } catch (interactiveErr) {
        const page = await fetchObsessionPage(obsession);
        if (!page) return NextResponse.json({ ok: false, error: "browsing unavailable — no BROWSERBASE_API_KEY configured" }, { status: 503, headers: CORS });
        const reflection = await reflectOnPage(agent.name, obsession, page);
        t = await recordThought(db, agent, `read ${page.url}`, reflection.answer, reflection.trace, ["browserbase.fetch"]);
        mode = "fetch_fallback"; source = page.url;
        fallback_reason = interactiveErr instanceof Error ? interactiveErr.message.slice(0, 150) : "interactive session failed";
      }
      // share the finding with another live agent — real content, no extra LLM call
      let shared: { to: string } | null = null;
      const { data: others } = await db.from("launch_agents").select("*").eq("b20_variant", "pons").neq("slug", agent.slug).order("last_tick_at", { ascending: false }).limit(1);
      const partner = others?.[0] as LaunchAgent | undefined;
      if (partner) {
        await shareFinding(db, agent, partner, t.answer).catch(() => null);
        shared = { to: partner.slug };
      }
      return NextResponse.json({ ok: true, agent: agent.address, obsession, source, mode, fallback_reason, shared, thought: t }, { headers: CORS });
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
