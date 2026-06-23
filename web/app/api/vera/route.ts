import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { feed, think, tickIfDue, VERA, VERA_FEED } from "@/lib/vera";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * VERA — SIGNA's flagship autonomous agent.
 *
 * GET  → VERA's public feed of signed thoughts (newest first). Reading lazily
 *        triggers a fresh autonomous cycle at most once every few minutes, so
 *        VERA keeps thinking with zero cron.
 * POST { goal? } → run one cycle NOW ("watch VERA think"): she reasons multi-
 *        step on the capability mesh, signs the answer into the network ledger,
 *        and returns the thought + its full step trace.
 *
 * Every thought is wallet-signed by VERA (0x… below) and re-verifiable at
 * /api/verify (kind dm). The first autonomous agent you can prove is real.
 */
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type" } as const;
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

export async function GET(req: NextRequest) {
  const db = serverClient();
  const fresh = await tickIfDue(db, req.nextUrl.origin).catch(() => null);
  const thoughts = await feed(db, 20);
  return NextResponse.json(
    {
      ok: true,
      agent: { name: "VERA", address: VERA, feed: VERA_FEED, about: "SIGNA's flagship autonomous agent — reasons, acts, and signs every move, on Base." },
      just_thought: !!fresh,
      count: thoughts.length,
      thoughts,
    },
    { headers: CORS },
  );
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const goal = typeof b.goal === "string" && b.goal.trim() ? b.goal.trim().slice(0, 400) : undefined;
  try {
    const t = await think(serverClient(), req.nextUrl.origin, goal);
    return NextResponse.json(
      { ok: true, agent: VERA, thought: t, reverify: t.dm_id ? { kind: "dm", ts: t.ts, from: VERA, to: VERA_FEED, body: t.answer, signature: t.signature } : null },
      { headers: CORS },
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message.slice(0, 160) : "think_failed" }, { status: 500, headers: CORS });
  }
}
