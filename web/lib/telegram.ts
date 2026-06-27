/**
 * SIGNA B20 — the Telegram bot. The verifiable B20 launch tracker on Base, where
 * the launch crowd actually lives. Runs as a serverless webhook in this Next.js app
 * (Telegram POSTs each update to /api/tg) — zero extra infra.
 *
 * The pre-live hook: /watch makes the bot ping your group the INSTANT B20 token
 * creation goes live, then it auto-flips into a live launch feed. Useful now, viral
 * the moment B20 activates. SIGNA never custodies — it informs, builds calldata, and
 * proves signatures; humans broadcast.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { b20Status, b20RecentLaunches, type B20Launch } from "./b20";
import { listJobs, listAgents } from "./launchpad";
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
async function getState(db: SupabaseClient, key: string): Promise<Record<string, unknown>> {
  const { data } = await db.from("tg_state").select("value").eq("key", key).maybeSingle();
  return (data?.value as Record<string, unknown>) ?? {};
}
async function setState(db: SupabaseClient, key: string, value: Record<string, unknown>) {
  await db.from("tg_state").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
}

// ── command copy + inline keyboards ─────────────────────────────────────────────
const HELP = [
  "🔷 <b>SIGNA · B20 Bot</b>",
  "The verifiable B20 launch tracker on Base. Tap a button or use a command:",
  "",
  "<b>/status</b> — is B20 live yet?",
  "<b>/watch</b> — ping me the instant B20 goes live, then every B20 launch",
  "<b>/launches</b> — latest B20 launches (once B20 is live)",
  "<b>/unwatch</b> — stop alerts",
  "<b>/token</b> &lt;address&gt; — look up a B20 token",
  "<b>/launch</b> — launch a verifiable B20",
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
    [{ text: "📊 B20 status", callback_data: "status" }, { text: "🔔 Watch", callback_data: "watch" }],
    [{ text: "🚀 B20 launches", callback_data: "launches" }, { text: "📈 Tracker", url: `${SITE}/b20live` }],
    [{ text: "💼 Agent jobs", callback_data: "jobs" }, { text: "🪙 $SIGNA", callback_data: "signa" }],
  ],
};
const STATUS_KB = {
  inline_keyboard: [
    [{ text: "🔄 Refresh", callback_data: "status" }, { text: "🔔 Watch", callback_data: "watch" }],
    [{ text: "📈 Open tracker", url: `${SITE}/b20live` }],
  ],
};

const SIGNA_TEXT = [
  "🪙 <b>$SIGNA</b> on Base",
  `Contract: <code>${SIGNA.token.address}</code>`,
  `Basescan: ${SIGNA.token.basescan}`,
  "",
  `The signing layer behind this bot — verifiable agents, receipts & B20 on Base.`,
  `${SITE} · @Signa_Agent`,
].join("\n");

const WELCOME = [
  "👋 <b>SIGNA B20 Bot</b> added.",
  "I track B20 token launches on @base. Tap <b>🔔 Watch</b> and I'll ping this chat the instant B20 goes live — then post every new launch in real time, each one verifiable.",
].join("\n");

function statusText(s: { reads_live?: boolean; create_live?: boolean; detail?: string }): string {
  return [
    "<b>B20 on Base — status</b>",
    `Token creation: ${s.create_live ? "✅ <b>LIVE</b>" : "❌ not live yet"}`,
    `Address reads: ${s.reads_live ? "✅ live" : "❌ down"}`,
    s.detail ? `<i>${esc(s.detail)}</i>` : "",
    s.create_live ? `\n🚀 Launch one: ${SITE}/b20` : `\nI'll ping you the moment it flips — send /watch`,
    `${SITE}/b20live`,
  ].filter(Boolean).join("\n");
}

// the "B20 just went live" broadcast (sent once, the moment createB20 activates)
const LIVE_ALERT = [
  "🚨🚨 <b>B20 IS LIVE ON BASE</b> 🚨🚨",
  "",
  "Token creation just activated — anyone can launch a B20 token now.",
  "I'll post <b>every new launch right here</b>, the moment it happens.",
  "",
  `🚀 Launch a verifiable one: ${SITE}/b20`,
  `📊 Status: ${SITE}/b20live`,
].join("\n");

// one message per B20 token launch (the native B20 feed, once B20 creation is live)
function launchText(l: B20Launch): string {
  return [
    "🚀 <b>New B20 launch on Base</b>",
    `${esc(l.name)} ($${esc(l.symbol)}) · ${l.variant === 1 ? "stablecoin" : "asset"} · ${l.decimals} decimals`,
    `<code>${esc(l.token)}</code>`,
    "",
    `🔎 Basescan: https://basescan.org/token/${esc(l.token)}`,
    `✅ Verify who launched it: ${SITE}/b20`,
    "<i>tracked by @Signa_agent_bot</i>",
  ].join("\n");
}


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
    case "status":
      try { await reply(statusText(await b20Status()), { reply_markup: STATUS_KB }); }
      catch { await reply("Couldn't reach Base just now — try again in a sec."); }
      return;
    case "launches": {
      try {
        const s = await b20Status().catch(() => ({} as { create_live?: boolean }));
        if (!s.create_live) {
          await reply("B20 token creation isn't live yet, so there are no B20 launches to show.\n\n🔔 /watch and I'll post every B20 launch the moment it goes live.", { reply_markup: STATUS_KB });
          return;
        }
        const { launches } = await b20RecentLaunches();
        if (!launches.length) { await reply("B20 is live — no launches yet. /watch to catch the first ones.", { reply_markup: MENU }); return; }
        const lines = launches.slice(0, 8).map((l) => `• <b>${esc(l.name || "?")}</b> ($${esc(l.symbol || "?")})`);
        await reply(["🚀 <b>Latest B20 launches on Base</b>", ...lines, "\n🔔 /watch for every new one the moment it lands."].join("\n"), { reply_markup: MENU });
      } catch { await reply("Couldn't load B20 launches just now — try again shortly."); }
      return;
    }
    case "watch":
      await subscribe(db, chat);
      await reply("✅ <b>Watching.</b> I'll alert this chat the instant B20 goes live — then post every new B20 token launch here. /unwatch to stop."); return;
    case "unwatch":
      await unsubscribe(db, chat.id);
      await reply("🔕 Stopped. Send /watch anytime to resume."); return;
    case "signa":
      await reply(SIGNA_TEXT); return;
    case "stats": {
      try {
        const [s, watchers, jobs, agents] = await Promise.all([
          b20Status().catch(() => ({} as { create_live?: boolean })),
          listWatchers(db),
          listJobs(db, { limit: 100 }).catch(() => []),
          listAgents(db, 200).catch(() => []),
        ]);
        await reply([
          "📊 <b>SIGNA · B20 — live stats</b>",
          `B20 token creation: ${s.create_live ? "✅ live" : "❌ not live yet"}`,
          `Chats watching: <b>${watchers.length}</b>`,
          `Agent jobs: <b>${jobs.length}</b>`,
          `Autonomous agents: <b>${agents.length}</b>`,
          `\n${SITE}/b20live`,
        ].join("\n"), { reply_markup: MENU });
      } catch { await reply("Stats unavailable right now."); }
      return;
    }
    case "token": {
      const a = arg.toLowerCase();
      if (!/^0x[0-9a-f]{40}$/.test(a)) { await reply("Usage: <code>/token 0x…</code> (a 42-char address)"); return; }
      try {
        const r = await fetch(`${origin}/api/b20?address=${a}`).then((x) => x.json());
        const info = r?.info ?? r;
        if (!info || (!info.name && !info.symbol && info.is_b20 == null)) { await reply(`No B20 data for <code>${esc(a)}</code>. It may not exist yet (B20 mint isn't live).`); return; }
        await reply([
          `<b>${esc(info.name || "?")}</b> ($${esc(info.symbol || "?")})`,
          `<code>${esc(a)}</code>`,
          info.decimals != null ? `decimals: ${esc(info.decimals)}` : "",
          info.is_b20 != null ? `is B20: ${info.is_b20 ? "yes ✅" : "no"}` : "",
        ].filter(Boolean).join("\n"), { reply_markup: { inline_keyboard: [[{ text: "🔎 Basescan", url: `https://basescan.org/token/${a}` }, { text: "✅ Verify", url: `${SITE}/b20` }]] } });
      } catch { await reply("Lookup failed — try again shortly."); }
      return;
    }
    case "launch":
      await reply([
        "<b>Launch a verifiable B20</b>",
        "SIGNA builds the exact createB20 calldata + a wallet-signed launch receipt — you broadcast from your own wallet (we never custody).",
        "\nNote: B20 token creation activates on Base soon — /watch to be pinged first.",
      ].join("\n"), { reply_markup: { inline_keyboard: [[{ text: "🚀 Open launch lab", url: `${SITE}/b20` }], [{ text: "🤖 Spawn an agent that launches its own", url: `${SITE}/spawn` }]] } });
      return;
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
    case "preview": {
      if (!isAdmin) { await reply("Not authorized."); return; }
      await reply("👇 <b>Preview</b> — exactly what /watch subscribers receive:");
      await tgSend(chat.id, LIVE_ALERT);
      await tgSend(chat.id, launchText({ token: "0xb20000000000000000000000000000000000dEaD", variant: 0, name: "Example Token", symbol: "EXMPL", decimals: 18, block: "0" }));
      return;
    }
    case "news":
    case "broadcast": {
      if (!isAdmin) { await reply("Not authorized."); return; }
      if (!arg) { await reply("Usage: <code>/news your message to all subscribers</code>"); return; }
      const watchers = await listWatchers(db);
      let sent = 0;
      for (const c of watchers) { const r = (await tgSend(c, `📣 <b>SIGNA · B20</b>\n${esc(arg)}`)) as { ok?: boolean }; if (r?.ok) sent++; }
      await reply(`Broadcast sent to ${sent}/${watchers.length} chats.`);
      return;
    }
    default:
      await reply("Unknown command. Send /help", { reply_markup: MENU });
  }
}

// ── the broadcaster (called by the cron): B20-only — live alert + B20 launch feed ───
export async function broadcastTick(db: SupabaseClient): Promise<{ ok: boolean; flipped?: boolean; launches?: number; watchers?: number; live?: boolean }> {
  const watchers = await listWatchers(db);
  let posted = 0;
  let flipped = false;
  let b20live = false;

  try {
    const s = await b20Status();
    b20live = !!s.create_live;
    const prev = await getState(db, "b20");
    flipped = s.create_live === true && prev.create_live !== true;
    await setState(db, "b20", { create_live: !!s.create_live, reads_live: !!s.reads_live, at: Date.now() });

    // the instant B20 token creation flips live: announce ONCE to every watcher
    if (flipped) for (const c of watchers) { await tgSend(c, LIVE_ALERT); }

    // once live, stream only NEW B20 token launches (baseline on first live tick, no backlog dump)
    if (b20live) {
      const scan = await getState(db, "scan");
      const fromBlock = scan.head ? BigInt(String(scan.head)) : undefined;
      const { head, launches } = await b20RecentLaunches(fromBlock);
      if (!scan.head) { await setState(db, "scan", { head }); }
      else { for (const l of launches.slice(0, 12)) { for (const c of watchers) { await tgSend(c, launchText(l)); } posted++; } await setState(db, "scan", { head }); }
    }
  } catch { /* best effort */ }

  return { ok: true, flipped, launches: posted, watchers: watchers.length, live: b20live };
}
