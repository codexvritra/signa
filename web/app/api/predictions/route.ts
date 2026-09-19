import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { resolveDuePredictions } from "@/lib/predictions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** GET /api/predictions — lazily resolves any due predictions, then returns the board. */
export async function GET() {
  const db = serverClient();
  await resolveDuePredictions(db).catch(() => null);

  const { data } = await db.from("stock_predictions").select("*").order("made_at", { ascending: false }).limit(100);
  const rows = data ?? [];

  const byAgent = new Map<string, { agent_slug: string; wins: number; losses: number; pending: number }>();
  for (const p of rows) {
    const s = byAgent.get(p.agent_slug) ?? { agent_slug: p.agent_slug, wins: 0, losses: 0, pending: 0 };
    if (!p.resolved) s.pending++;
    else if (p.correct) s.wins++;
    else s.losses++;
    byAgent.set(p.agent_slug, s);
  }
  const leaderboard = [...byAgent.values()].sort((a, b) => b.wins - b.losses - (a.wins - a.losses));

  return NextResponse.json({ ok: true, predictions: rows, leaderboard });
}
