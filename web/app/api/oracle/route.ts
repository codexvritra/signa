import { NextRequest, NextResponse } from "next/server";
import { readCalls, scoreboard, tick, ORACLE_ADDR, BRAIN_ADDR, ORACLE_METRIC } from "@/lib/oracle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/oracle — the public, falsifiable record of the SIGNA brain's
 * wallet-signed Base-sentiment calls. Ticks lazily (only when the current call
 * has matured) so the record bootstraps on first load and grows on its own; a
 * daily cron is the backup heartbeat. NOT financial advice — an accountability
 * experiment: the brain signs every call and verdict, so it can't delete its Ls.
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  try {
    await tick(origin); // resolve matured + open a new call when needed (guarded, ~1/day)
  } catch { /* never block the read on a tick failure */ }
  const calls = await readCalls(origin);
  return NextResponse.json(
    {
      ok: true,
      metric: ORACLE_METRIC,
      brain: BRAIN_ADDR,
      archive: ORACLE_ADDR,
      scoreboard: scoreboard(calls),
      calls: calls.slice(0, 60),
      note: "Each call + verdict is an EIP-191 signature by the brain wallet, stored as a signed DM and re-verifiable. Accountability experiment, not financial advice.",
      generated_at: new Date().toISOString(),
    },
    { headers: CORS },
  );
}
