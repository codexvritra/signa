import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { createAgent, listAgents, agentThink, getAgent, agentFeed } from "@/lib/launchpad";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * SIGNA Autonomous Agents — anyone launches an agent that thinks on its own.
 *
 * Unlike a static agent profile, these are SIGNA-hosted autonomous agents: each
 * gets its own deterministic keyless wallet + the ALETHEIA brain, and on a
 * heartbeat it reasons over live data and SIGNS a thought into the network ledger.
 * Bankr launches tokens; SIGNA launches agents.
 *
 * GET  → the directory of autonomous agents.
 * POST { name, mission, persona?, creator } → mint one + run its first cycle now.
 */
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type" } as const;
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

export async function GET() {
  const db = serverClient();
  const agents = await listAgents(db, 60);
  return NextResponse.json({ ok: true, count: agents.length, agents }, { headers: CORS });
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const db = serverClient();
  const { agent, error } = await createAgent(db, { name: b.name, mission: b.mission, persona: b.persona, creator: b.creator });
  if (error || !agent) return NextResponse.json({ ok: false, error: error ?? "create_failed" }, { status: 400, headers: CORS });
  let thought = null;
  try { thought = await agentThink(db, req.nextUrl.origin, agent); } catch { /* agent still created */ }
  const fresh = await getAgent(db, agent.slug);
  return NextResponse.json({
    ok: true,
    agent: fresh ?? agent,
    thought,
    url: `${req.nextUrl.origin}/spawn/${agent.slug}`,
    reverify: thought?.signature ? { kind: "dm", ts: thought.ts, from: agent.address, to: agentFeed(agent.slug), body: thought.answer, signature: thought.signature } : null,
  }, { headers: CORS });
}
