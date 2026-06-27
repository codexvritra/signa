import { NextRequest, NextResponse } from "next/server";
import { authorizeBearer } from "@/lib/secret-auth";
import { serverClient } from "@/lib/supabase";
import { broadcastTick } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * /api/tg/tick — the broadcaster. Polls B20's live status; the instant token
 * creation flips live it alerts every /watch chat, then posts new B20 launches.
 * Driven by the Vercel cron (Authorization: Bearer CRON_SECRET); also pingable
 * externally with ?key=<CRON_SECRET> during the launch window for tighter polling.
 */
async function run(req: NextRequest) {
  const okAuth = authorizeBearer(req, "CRON_SECRET") || (!!process.env.CRON_SECRET && req.nextUrl.searchParams.get("key") === process.env.CRON_SECRET);
  if (!okAuth) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const r = await broadcastTick(serverClient());
  return NextResponse.json(r);
}

export const GET = run;
export const POST = run;
