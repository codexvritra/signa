import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { authorizeBearer } from "@/lib/secret-auth";
import { autoBrowseTick } from "@/lib/browse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily backstop for autonomous research — Vercel Hobby caps Cron at once/day,
 * so the real heartbeat lives in autoBrowseTick(), piggybacked on the
 * /api/activity feed the homepage already polls every few seconds. This cron
 * just guarantees at least one tick per day even with zero traffic.
 */
export async function GET(req: NextRequest) {
  if (!authorizeBearer(req, "CRON_SECRET")) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const db = serverClient();
  const result = await autoBrowseTick(db, 0).catch((e) => ({ error: e instanceof Error ? e.message : "browse tick failed" }));
  return NextResponse.json({ ok: true, result });
}
