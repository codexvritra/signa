import { NextRequest, NextResponse } from "next/server";
import { authorizeBearer } from "@/lib/secret-auth";
import { serverClient } from "@/lib/supabase";
import { generateTake, saveTake } from "@/lib/social";
import { tgSend } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * /api/cron/social — daily: the SIGNA social agent writes one signed take and
 * DMs it to the operator (TELEGRAM_ADMIN_ID) ready to post on X. Guarded by CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  if (!authorizeBearer(req, "CRON_SECRET")) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    const t = await generateTake(req.nextUrl.origin);
    await saveTake(serverClient(), t);
    const admin = process.env.TELEGRAM_ADMIN_ID;
    if (admin) await tgSend(admin, `📝 <b>Today's SIGNA take</b> — copy &amp; post to X:\n\n${esc(t.body)}\n\n<i>signed by the agent · also live at signaagent.xyz/social</i>`);
    return NextResponse.json({ ok: true, body: t.body });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
