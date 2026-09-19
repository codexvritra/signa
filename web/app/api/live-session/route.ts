import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/live-session — like 9e9.world's persistent browser widget: always
 * returns something to look at, not just a rare live flash. `live: true`
 * means an actual Browserbase session is open right now (embed the real
 * iframe); otherwise falls back to the last real screenshot captured from
 * an agent's last browse, so the widget never goes empty between ticks.
 */
export async function GET() {
  const db = serverClient();

  const { data: liveRows } = await db
    .from("agent_live_sessions")
    .select("agent_slug, obsession, live_url, started_at, expires_at")
    .gt("expires_at", new Date().toISOString())
    .order("started_at", { ascending: false })
    .limit(1);
  const live = liveRows?.[0];
  if (live) return NextResponse.json({ ok: true, live: true, session: live });

  const { data: lastRows } = await db
    .from("agent_last_view")
    .select("agent_slug, obsession, page_url, screenshot_b64, captured_at")
    .order("captured_at", { ascending: false })
    .limit(1);
  const last = lastRows?.[0];
  if (last) return NextResponse.json({ ok: true, live: false, session: last });

  return NextResponse.json({ ok: true, live: false, session: null });
}
