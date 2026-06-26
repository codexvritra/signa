import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { getAgent, thoughtsFor, tickIfDue, agentThink, agentChat, agentFeed } from "@/lib/launchpad";

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
    if (action === "chat") {
      const msg = String(b.message ?? "").trim();
      if (!msg) return NextResponse.json({ ok: false, error: "message required" }, { status: 400, headers: CORS });
      const r = await agentChat(db, req.nextUrl.origin, agent, msg);
      return NextResponse.json({ ok: true, agent: agent.address, ...r }, { headers: CORS });
    }
    const t = await agentThink(db, req.nextUrl.origin, agent, typeof b.goal === "string" ? b.goal : undefined);
    return NextResponse.json({ ok: true, agent: agent.address, thought: t, reverify: t.signature ? { kind: "dm", ts: t.ts, from: agent.address, to: agentFeed(slug), body: t.answer, signature: t.signature } : null }, { headers: CORS });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message.slice(0, 160) : "failed" }, { status: 500, headers: CORS });
  }
}
