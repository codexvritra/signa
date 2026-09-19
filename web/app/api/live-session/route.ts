import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/live-session — the currently-open Browserbase session, if any agent is browsing right now. */
export async function GET() {
  const db = serverClient();
  const { data } = await db
    .from("agent_live_sessions")
    .select("agent_slug, obsession, live_url, started_at, expires_at")
    .gt("expires_at", new Date().toISOString())
    .order("started_at", { ascending: false })
    .limit(1);
  return NextResponse.json({ ok: true, session: data?.[0] ?? null });
}
