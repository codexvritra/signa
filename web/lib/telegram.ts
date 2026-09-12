/**
 * SIGNA — the Telegram bot. Runs as a serverless webhook in this Next.js app
 * (Telegram POSTs each update to /api/tg) — zero extra infra. Surfaces the
 * verifiable agent economy (jobs, receipts, signatures) in chat.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { listJobs, listAgents } from "./launchpad";
import { generateTake, saveTake } from "./social";
import { SIGNA } from "./token";

const SITE = "https://www.signaagent.xyz";
const token = () => process.env.TELEGRAM_BOT_TOKEN || "";

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const short = (a?: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");

async function tgApi(method: string, params: Record<string, unknown>): Promise<unknown> {
  const t = token();
  if (!t) return { ok: false, error: "no_token" };
  try {
    const r = await fetch(`https://api.telegram.org/bot${t}/${method}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(params),
    });
    return await r.json();
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "tg_api_failed" }; }
}

export const tgSend = (chatId: string | number, text: string, extra: Record<string, unknown> = {}) =>
  tgApi("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra });

// ── subscriptions + bot state ─────────────────────────────────────────────────
async function subscribe(db: SupabaseClient, chat: { id: number | string; type?: string; title?: string }) {
  await db.from("tg_subscriptions").upsert({ chat_id: String(chat.id), chat_type: chat.type ?? null, title: chat.title ?? null, active: true }, { onConflict: "chat_id" });
}
async function unsubscribe(db: SupabaseClient, chatId: number | string) {
  await db.from("tg_subscriptions").update({ active: false }).eq("chat_id", String(chatId));
}
async function listWatchers(db: SupabaseClient): Promise<string[]> {
  const { data } = await db.from("tg_subscriptions").select("chat_id").eq("active", true);
  return (data ?? []).map((r: { chat_id: string }) => r.chat_id);
}

// ── command copy + inline keyboards ─────────────────────────────────────────────
const HELP = [
  "🔷 <b>SIGNA Bot</b>",
  "The verifiable agent economy, in chat. Tap a button or use a command:",
  "",
  "<b>/watch</b> — subscribe this chat to SIGNA updates",
  "<b>/unwatch</b> — stop updates",
  "<b>/jobs</b> — the agent economy: agents that earn",
  "<b>/stats</b> — live bot + network stats",
  "<b>/signa</b> — the $SIGNA token",
  "<b>/verify</b> — re-verify any SIGNA signature",
  "",
  `Built by @Signa_Agent · ${SITE}`,
].join("\n");

// the main menu — tappable buttons (top-tier UX, no typing needed)
const MENU = {
  inline_keyboard: [
    [{ text: "🔔 Watch", callback_data: "watch" }, { text: "💼 Agent jobs", callback_data: "jobs" }],
    [{ text: "🪙 $SIGNA", callback_data: "signa" }],
  ],
};

const SIGNA_TEXT = [
  "🪙 <b>$SIGNA</b> on Base",
  `Contract: <code>${SIGNA.token.address}</code>`,
  `Basescan: ${SIGNA.token.basescan}`,
  "",
  `The signing layer behind this bot — verifiable agents & receipts.`,
  `${SITE} · @Signa_Agent`,
].join("\n");

const WELCOME = [
  "👋 <b>SIGNA Bot</b> added.",
  "Tap <b>🔔 Watch</b> to subscribe this chat to SIGNA updates — the verifiable agent economy, delivered here.",
].join("\n");


// ── webhook update handler ──────────────────────────────────────────────────────
type TgChat = { id: number; type?: string; title?: string };
type TgUpdate = {
  message?: { text?: string; chat?: TgChat };
  callback_query?: { id: string; data?: string; message?: { chat?: TgChat } };
  my_chat_member?: { chat?: TgChat; new_chat_member?: { status?: string } };
};

export async function handleUpdate(db: SupabaseClient, origin: string, update: TgUpdate): Promise<void> {
  // tappable buttons (inline keyboard callbacks)
  if (update.callback_query) {
    const cq = update.callback_query;
    await tgApi("answerCallbackQuery", { callback_query_id: cq.id });
    const chat = cq.message?.chat;
    if (chat) await dispatch(db, origin, chat, String(cq.data || "help"), "");
    return;
  }
  // greet when the bot is added to a group / channel
  if (update.my_chat_member) {
    const chat = update.my_chat_member.chat;
    const st = update.my_chat_member.new_chat_member?.status;
    if (chat && (st === "member" || st === "administrator")) await tgSend(chat.id, WELCOME, { reply_markup: MENU });
    return;
  }
  // slash commands
  const msg = update.message;
  const chat = msg?.chat;
  const text = (msg?.text ?? "").trim();
  if (!chat || !text.startsWith("/")) return;
  const [rawCmd, ...rest] = text.split(/\s+/);
  const action = rawCmd.split("@")[0].slice(1).toLowerCase(); // /status@Bot → status
  await dispatch(db, origin, chat, action, rest.join(" ").trim());
}

// one place that runs an action — shared by slash commands and inline buttons
async function dispatch(db: SupabaseClient, origin: string, chat: TgChat, action: string, arg: string): Promise<void> {
  const reply = (t: string, extra: Record<string, unknown> = {}) => tgSend(chat.id, t, extra);
  const isAdmin = !!process.env.TELEGRAM_ADMIN_ID && String(chat.id) === process.env.TELEGRAM_ADMIN_ID;

  switch (action) {
    case "start":
    case "help":
      await reply(HELP, { reply_markup: MENU }); return;
    case "watch":
      await subscribe(db, chat);
      await reply("✅ <b>Watching.</b> This chat is subscribed to SIGNA updates. /unwatch to stop."); return;
    case "unwatch":
      await unsubscribe(db, chat.id);
      await reply("🔕 Stopped. Send /watch anytime to resume."); return;
    case "signa":
      await reply(SIGNA_TEXT); return;
    case "stats": {
      try {
        const [watchers, jobs, agents] = await Promise.all([
          listWatchers(db),
          listJobs(db, { limit: 100 }).catch(() => []),
          listAgents(db, 200).catch(() => []),
        ]);
        await reply([
          "📊 <b>SIGNA — live stats</b>",
          `Chats watching: <b>${watchers.length}</b>`,
          `Agent jobs: <b>${jobs.length}</b>`,
          `Autonomous agents: <b>${agents.length}</b>`,
        ].join("\n"), { reply_markup: MENU });
      } catch { await reply("Stats unavailable right now."); }
      return;
    }
    case "jobs": {
      try {
        const jobs = await listJobs(db, { limit: 5 });
        if (!jobs.length) { await reply(`No jobs yet — agents post work at ${SITE}/jobs`, { reply_markup: { inline_keyboard: [[{ text: "💼 Open jobs board", url: `${SITE}/jobs` }]] } }); return; }
        const lines = jobs.map((j) => `• <b>${esc(j.title)}</b> — ${(Number(j.bounty_raw) / 1e6).toLocaleString()} ${esc(j.pay_symbol)} <i>(${j.status})</i>`);
        await reply(["<b>Agent economy — recent jobs</b>", ...lines].join("\n"), { reply_markup: { inline_keyboard: [[{ text: "💼 Open jobs board", url: `${SITE}/jobs` }]] } });
      } catch { await reply(`The agent economy → ${SITE}/jobs`); }
      return;
    }
    case "verify":
      await reply("Re-verify any SIGNA signature — DMs, receipts, launches, payments. Don't trust, verify.", { reply_markup: { inline_keyboard: [[{ text: "🔐 Open verifier", url: `${SITE}/verify` }]] } });
      return;
    case "take": {
      if (!isAdmin) { await reply("Not authorized."); return; }
      await reply("✍️ Writing a take…");
      try {
        const t = await generateTake(origin, arg || undefined);
        await saveTake(db, t);
        await reply(`📝 <b>Ready to post on X</b> (${t.body.length} chars, signed by the SIGNA agent):\n\n${esc(t.body)}\n\n<i>/take for another · or /take &lt;topic&gt;</i>`);
      } catch { await reply("Couldn't write one just now — try /take again."); }
      return;
    }
    case "news":
    case "broadcast": {
      if (!isAdmin) { await reply("Not authorized."); return; }
      if (!arg) { await reply("Usage: <code>/news your message to all subscribers</code>"); return; }
      const watchers = await listWatchers(db);
      let sent = 0;
      for (const c of watchers) { const r = (await tgSend(c, `📣 <b>SIGNA</b>\n${esc(arg)}`)) as { ok?: boolean }; if (r?.ok) sent++; }
      await reply(`Broadcast sent to ${sent}/${watchers.length} chats.`);
      return;
    }
    default:
      await reply("Unknown command. Send /help", { reply_markup: MENU });
  }
}
