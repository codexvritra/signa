import { NextRequest, NextResponse } from "next/server";
import { authorizeBearer } from "@/lib/secret-auth";
import { serverClient } from "@/lib/supabase";
import { generateTake, saveTake } from "@/lib/social";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function tgSend(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
  } catch { /* best-effort admin notify */ }
}

/**
 * /api/cron/social — daily: the SIGDA social agent writes one signed take and
 * DMs it to the operator (TELEGRAM_ADMIN_ID) ready to post on X. Guarded by CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  if (!authorizeBearer(req, "CRON_SECRET")) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    const t = await generateTake(req.nextUrl.origin);
    await saveTake(serverClient(), t);
    const admin = process.env.TELEGRAM_ADMIN_ID;
    if (admin) await tgSend(admin, `📝 <b>Today's SIGDA take</b> — copy &amp; post to X:\n\n${esc(t.body)}\n\n<i>signed by the agent · also live at sigda.xyz/social</i>`);
    return NextResponse.json({ ok: true, body: t.body });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
