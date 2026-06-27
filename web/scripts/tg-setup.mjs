// One-time Telegram webhook setup. After you create the bot with @BotFather:
//   TELEGRAM_BOT_TOKEN=123:ABC TELEGRAM_WEBHOOK_SECRET=somesecret node scripts/tg-setup.mjs
// Points the bot at https://www.signaagent.xyz/api/tg with a secret header.
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "";
const URL = process.env.TG_WEBHOOK_URL || "https://www.signaagent.xyz/api/tg";
if (!TOKEN) { console.error("set TELEGRAM_BOT_TOKEN (from @BotFather)"); process.exit(1); }

const api = (m, body) => fetch(`https://api.telegram.org/bot${TOKEN}/${m}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

const me = await api("getMe", {});
console.log("bot:", me.result?.username ? `@${me.result.username}` : me);

const set = await api("setWebhook", { url: URL, secret_token: SECRET || undefined, allowed_updates: ["message", "callback_query", "my_chat_member"], drop_pending_updates: true });
console.log("setWebhook:", set);

const info = await api("getWebhookInfo", {});
console.log("webhook:", info.result?.url, "pending:", info.result?.pending_update_count);

// nice-to-have: register the command menu shown in Telegram's UI
await api("setMyCommands", { commands: [
  { command: "status", description: "Is B20 live yet?" },
  { command: "watch", description: "Ping me the instant B20 goes live + launches" },
  { command: "launches", description: "Latest B20 launches (once B20 is live)" },
  { command: "unwatch", description: "Stop alerts" },
  { command: "token", description: "Look up a B20 token by address" },
  { command: "launch", description: "Launch a verifiable B20" },
  { command: "jobs", description: "The agent economy" },
  { command: "stats", description: "Live bot + network stats" },
  { command: "signa", description: "The $SIGNA token" },
  { command: "verify", description: "Re-verify any SIGNA signature" },
] });
console.log("done — message the bot /status to test.");
