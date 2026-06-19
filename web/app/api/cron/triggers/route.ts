import { NextRequest, NextResponse } from "next/server";
import { authorizeBearer } from "@/lib/secret-auth";
import { serverClient } from "@/lib/supabase";
import { tickTriggers } from "@/lib/triggers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/triggers — evaluate armed triggers and fire the ones whose
 * condition is met (and expire the lapsed). The public /api/triggers read also
 * ticks lazily, so this is a backstop that advances triggers with zero traffic.
 * Guarded by CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  if (!authorizeBearer(req, "CRON_SECRET")) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const r = await tickTriggers(serverClient());
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "tick_failed" }, { status: 500 });
  }
}
