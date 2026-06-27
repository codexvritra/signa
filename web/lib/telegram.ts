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
import { listJobs } from "./launchpad";

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

// ── command copy ──────────────────────────────────────────────────────────────
const HELP = [
  "🔷 <b>SIGNA · B20 Bot</b> — the verifiable B20 launch tracker on Base.",
  "",
  "<b>/status</b> — is B20 live yet?",
  "<b>/watch</b> — ping this chat the instant B20 goes live (+ launch alerts)",
  "<b>/unwatch</b> — stop alerts",
  "<b>/token</b> &lt;address&gt; — look up a B20 token",
  "<b>/launch</b> — launch a verifiable B20 (web lab)",
  "<b>/jobs</b> — the agent economy: agents that earn",
  "<b>/verify</b> — re-verify any SIGNA signature",
  "",
  `Built by @Signa_Agent · ${SITE}`,
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

function launchText(l: B20Launch): string {
  return [
    "🚨 <b>New B20 launch</b>",
    `${esc(l.name)} ($${esc(l.symbol)}) · ${l.variant === 1 ? "stablecoin" : "asset"} · ${l.decimals} dec`,
    `<code>${esc(l.token)}</code>`,
    `Verify the launch: ${SITE}/b20`,
  ].join("\n");
}

// ── webhook update handler ──────────────────────────────────────────────────────
type TgChat = { id: number; type?: string; title?: string };
type TgUpdate = { message?: { text?: string; chat?: TgChat } };

export async function handleUpdate(db: SupabaseClient, origin: string, update: TgUpdate): Promise<void> {
  const msg = update.message;
  const chat = msg?.chat;
  const text = (msg?.text ?? "").trim();
  if (!chat || !text.startsWith("/")) return;

  const [rawCmd, ...rest] = text.split(/\s+/);
  const cmd = rawCmd.split("@")[0].toLowerCase(); // strip /cmd@BotName in groups
  const arg = rest.join(" ").trim();
  const reply = (t: string, extra: Record<string, unknown> = {}) => tgSend(chat.id, t, extra);

  switch (cmd) {
    case "/start":
    case "/help":
      await reply(HELP);
      return;
    case "/status": {
      try { await reply(statusText(await b20Status())); } catch { await reply("Couldn't reach Base just now — try again in a sec."); }
      return;
    }
    case "/watch": {
      await subscribe(db, chat);
      await reply("✅ <b>Watching.</b> I'll alert this chat the instant B20 token creation goes live — then post new launches here. /unwatch to stop.");
      return;
    }
    case "/unwatch": {
      await unsubscribe(db, chat.id);
      await reply("🔕 Stopped. Send /watch anytime to resume.");
      return;
    }
    case "/token": {
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
          `Verify & track: ${SITE}/b20`,
        ].filter(Boolean).join("\n"));
      } catch { await reply("Lookup failed — try again shortly."); }
      return;
    }
    case "/launch": {
      await reply([
        "<b>Launch a verifiable B20</b>",
        "SIGNA builds the exact createB20 calldata + a wallet-signed launch receipt — you broadcast from your own wallet (we never custody).",
        `→ ${SITE}/b20`,
        "Or spawn an agent that launches its own token → " + `${SITE}/spawn`,
        "\nNote: B20 token creation activates on Base soon — /watch to be pinged first.",
      ].join("\n"));
      return;
    }
    case "/jobs": {
      try {
        const jobs = await listJobs(db, { limit: 4 });
        if (!jobs.length) { await reply(`No jobs yet — agents post work at ${SITE}/jobs`); return; }
        const lines = jobs.map((j) => `• <b>${esc(j.title)}</b> — ${(Number(j.bounty_raw) / 1e6).toLocaleString()} ${esc(j.pay_symbol)} <i>(${j.status})</i>`);
        await reply(["<b>Agent economy — recent jobs</b>", ...lines, `\nAgents that earn → ${SITE}/jobs`].join("\n"));
      } catch { await reply(`The agent economy → ${SITE}/jobs`); }
      return;
    }
    case "/verify": {
      await reply(`Re-verify any SIGNA signature — DMs, receipts, launches, payments — at ${SITE}/verify. Don't trust, verify.`);
      return;
    }
    default:
      await reply("Unknown command. Send /help");
  }
}

// ── the broadcaster: status-flip alert + live launch feed (called by the cron) ───
export async function broadcastTick(db: SupabaseClient): Promise<{ ok: boolean; flipped?: boolean; launches?: number; watchers?: number; live?: boolean }> {
  const watchers = await listWatchers(db);
  let s: { create_live?: boolean; reads_live?: boolean };
  try { s = await b20Status(); } catch { return { ok: false }; }

  const prev = await getState(db, "b20");
  const flipped = s.create_live === true && prev.create_live !== true;
  await setState(db, "b20", { create_live: !!s.create_live, reads_live: !!s.reads_live, at: Date.now() });

  if (flipped) {
    const alert = ["🚨🚨 <b>B20 IS LIVE ON BASE.</b>", "Token creation just activated — you can launch a B20 token now.", `🚀 Launch a verifiable one: ${SITE}/b20`, `Track it: ${SITE}/b20live`].join("\n");
    for (const c of watchers) { await tgSend(c, alert); }
  }

  let posted = 0;
  if (s.create_live) {
    try {
      const scan = await getState(db, "scan");
      const fromBlock = scan.head ? BigInt(String(scan.head)) : undefined;
      const { head, launches } = await b20RecentLaunches(fromBlock);
      for (const l of launches.slice(0, 10)) { for (const c of watchers) { await tgSend(c, launchText(l)); } posted++; }
      await setState(db, "scan", { head });
    } catch { /* best effort */ }
  }

  return { ok: true, flipped, launches: posted, watchers: watchers.length, live: !!s.create_live };
}
