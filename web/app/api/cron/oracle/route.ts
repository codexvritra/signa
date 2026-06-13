import { NextRequest, NextResponse } from "next/server";
import { authorizeBearer } from "@/lib/secret-auth";
import { tick } from "@/lib/oracle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/oracle — the daily heartbeat that resolves yesterday's signed
 * call and opens today's. The public /api/oracle read also ticks lazily, so
 * this cron is a backup that keeps the record advancing with zero traffic.
 * Guarded by CRON_SECRET (Vercel cron sends it as a bearer token).
 */
export async function GET(req: NextRequest) {
  if (!authorizeBearer(req, "CRON_SECRET")) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    await tick(req.nextUrl.origin);
    return NextResponse.json({ ok: true, ticked: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "tick_failed" }, { status: 500 });
  }
}
