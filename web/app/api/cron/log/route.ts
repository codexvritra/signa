import { NextRequest, NextResponse } from "next/server";
import { authorizeBearer } from "@/lib/secret-auth";
import { serverClient } from "@/lib/supabase";
import { tick } from "@/lib/transparency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/log — append a transparency-log checkpoint if new messages
 * landed since the last one. The public /api/log read also ticks lazily, so
 * this cron is a backstop that advances the log even with zero read traffic.
 * Guarded by CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  if (!authorizeBearer(req, "CRON_SECRET")) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const cp = await tick(serverClient(), Date.now());
    return NextResponse.json({ ok: true, checkpoint: cp ? { seq: cp.seq, tree_size: cp.tree_size, root: cp.root } : null });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "tick_failed" }, { status: 500 });
  }
}
