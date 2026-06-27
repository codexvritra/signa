import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { handleUpdate } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * /api/tg — the Telegram bot webhook. Telegram POSTs each update here.
 * Secured by the secret_token set on setWebhook (sent back in
 * X-Telegram-Bot-Api-Secret-Token). We always return 200 quickly so Telegram
 * doesn't retry; command work is awaited but light (reads + links, no LLM).
 */
export async function GET() {
  // health check (so you can confirm the route is deployed before setting the webhook)
  return NextResponse.json({ ok: true, bot: "signa-b20", configured: !!process.env.TELEGRAM_BOT_TOKEN });
}

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  let update: unknown = null;
  try { update = await req.json(); } catch { return NextResponse.json({ ok: true }); }
  try {
    await handleUpdate(serverClient(), req.nextUrl.origin, update as Parameters<typeof handleUpdate>[2]);
  } catch { /* never make Telegram retry on our error */ }
  return NextResponse.json({ ok: true });
}
