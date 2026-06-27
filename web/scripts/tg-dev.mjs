// Local pre-release tester for the SIGNA B20 bot — runs the bot in POLLING mode
// against your LOCAL dev server, so you can test every command before going public.
//
// Terminal 1:  cd web && npm run dev        (needs .env.local: TELEGRAM_BOT_TOKEN,
//                                             TELEGRAM_ADMIN_ID, supabase keys)
// Terminal 2:  node scripts/tg-dev.mjs      (reads .env.local automatically)
//
// Then DM your bot /status, /watch, /jobs, /news ... and watch it reply. Nothing is
// deployed and no webhook is set, so this never touches production or the public.
import { readFileSync } from "node:fs";

// minimal .env.local loader (so you don't have to export anything)
try {
  for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* no .env.local — rely on real env */ }

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "";
const TARGET = process.env.TG_LOCAL_URL || "http://localhost:3000/api/tg";
if (!TOKEN) { console.error("Set TELEGRAM_BOT_TOKEN (in web/.env.local). Get it from @BotFather."); process.exit(1); }

const tg = (m, q = "") => fetch(`https://api.telegram.org/bot${TOKEN}/${m}${q}`).then((r) => r.json());

const me = await tg("getMe");
if (!me.ok) { console.error("Token rejected by Telegram:", me.description, "— regenerate via @BotFather /mybots → API Token."); process.exit(1); }
console.log(`✅ @${me.result.username} (${me.result.first_name}) — polling. Forwarding updates → ${TARGET}`);
console.log("   DM the bot /status, /watch, /jobs ... Ctrl-C to stop.\n");

await tg("deleteWebhook", "?drop_pending_updates=false"); // polling needs no webhook

let offset = 0;
for (;;) {
  let updates;
  try { updates = await tg("getUpdates", `?timeout=30&offset=${offset}`); } catch { await new Promise((r) => setTimeout(r, 2000)); continue; }
  if (!updates.ok) { await new Promise((r) => setTimeout(r, 2000)); continue; }
  for (const u of updates.result) {
    offset = u.update_id + 1;
    const t = u.message?.text;
    if (t) console.log(`→ ${u.message.chat.id}: ${t}`);
    try {
      await fetch(TARGET, { method: "POST", headers: { "content-type": "application/json", ...(SECRET ? { "x-telegram-bot-api-secret-token": SECRET } : {}) }, body: JSON.stringify(u) });
    } catch (e) { console.error("  forward failed (is `npm run dev` running?):", e.message); }
  }
}
