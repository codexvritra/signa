import { NextRequest, NextResponse } from "next/server";
import { authorizeBearer } from "@/lib/secret-auth";
import { serverClient } from "@/lib/supabase";
import { tick } from "@/lib/oracle";
import { think as veraThink } from "@/lib/vera";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/oracle — the daily heartbeat. Resolves yesterday's signed
 * oracle call + opens today's, AND fires one VERA autonomous cycle so the
 * flagship agent has a guaranteed daily signed thought (the /vera + /oracle
 * reads also tick lazily). Guarded by CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  if (!authorizeBearer(req, "CRON_SECRET")) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const out: { oracle?: boolean; vera?: string | null; error?: string } = {};
  try {
    await tick(req.nextUrl.origin);
    out.oracle = true;
  } catch (e) {
    out.error = e instanceof Error ? e.message : "oracle_tick_failed";
  }
  // VERA's daily autonomous heartbeat — best-effort, never blocks the oracle.
  try {
    const t = await veraThink(serverClient(), req.nextUrl.origin);
    out.vera = t.dm_id ?? "thought";
  } catch {
    out.vera = null;
  }
  return NextResponse.json({ ok: true, ...out });
}
