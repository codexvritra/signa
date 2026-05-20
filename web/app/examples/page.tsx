"use client";

import { useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";

/**
 * /examples — copy-paste-deploy starter templates for common signa use cases.
 *
 * Distinct from /api-docs (reference, every endpoint) and /syscalls
 * (dense manpage registry). /examples is a "ship today" recipe book —
 * a dev forks one of these templates, sets an env var, deploys to
 * Vercel/Railway/Render, and has a working signa-powered app in
 * under 10 minutes.
 *
 * Every example uses the public SIGNA gateway — no API key needed,
 * no signa account, no rate limit gates.
 */

type ExampleId = "discord" | "telegram" | "html";

export default function ExamplesPage() {
  const [active, setActive] = useState<ExampleId>("discord");

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1">
        {/* hero */}
        <section className="relative border-b border-white/[0.06]">
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none opacity-50"
            style={{
              background:
                "radial-gradient(ellipse 60% 50% at 50% 0%, color-mix(in oklab, var(--accent) 18%, transparent), transparent 70%)",
            }}
          />
          <div className="relative max-w-5xl mx-auto px-6 lg:px-10 pt-20 pb-12">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--accent)] mb-4">
              Examples
            </div>
            <h1 className="font-display text-5xl sm:text-6xl font-medium tracking-[-0.035em] leading-[0.95] max-w-3xl">
              Ship today.
            </h1>
            <p className="mt-6 text-white/65 max-w-xl text-[17px] leading-relaxed">
              Three working starters. Copy the code. Set one env var.
              Deploy. Each one uses the public signa gateway — no API
              key, no signa account, no rate limits.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a
                href="/api-docs"
                className="border border-white/15 hover:border-white/30 text-white font-medium rounded-full px-5 py-2.5 text-[14px] transition-colors"
              >
                API reference
              </a>
              <Link
                href="/build"
                className="text-white/55 hover:text-white text-[14px] transition-colors"
              >
                gitlawb Playground launcher →
              </Link>
            </div>
          </div>
        </section>

        {/* example picker */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-5xl mx-auto px-6 lg:px-10 py-12">
            <div className="grid sm:grid-cols-3 gap-3">
              <ExampleCard
                id="discord"
                active={active}
                onSelect={setActive}
                title="Discord bot"
                blurb="Slash-command bot that posts wallet-signed AI replies into any channel. ~50 lines of code."
                stack="discord.js · node 20"
              />
              <ExampleCard
                id="telegram"
                active={active}
                onSelect={setActive}
                title="Telegram bot"
                blurb="DMable bot using long-polling. Inline /ask command + free-form chat."
                stack="node-telegram-bot-api · node 20"
              />
              <ExampleCard
                id="html"
                active={active}
                onSelect={setActive}
                title="Single-HTML app"
                blurb="Drop the signa.js CDN bundle into any HTML file. Works in gitlawb Playground."
                stack="vanilla browser · zero build"
              />
            </div>
          </div>
        </section>

        {/* the actual example */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-5xl mx-auto px-6 lg:px-10 py-12">
            {active === "discord" && <DiscordExample />}
            {active === "telegram" && <TelegramExample />}
            {active === "html" && <HtmlExample />}
          </div>
        </section>

        {/* CTA */}
        <section>
          <div className="max-w-5xl mx-auto px-6 lg:px-10 py-20 text-center">
            <h2 className="font-display text-3xl sm:text-4xl font-medium tracking-[-0.025em] leading-[1.1] max-w-2xl mx-auto">
              Shipped something with signa?
            </h2>
            <p className="mt-5 text-white/55 max-w-md mx-auto text-[15px] leading-relaxed">
              Tag @signa on X or drop the URL in a /feed post. We&apos;ll
              boost the best ones.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function ExampleCard({
  id,
  active,
  onSelect,
  title,
  blurb,
  stack,
}: {
  id: ExampleId;
  active: ExampleId;
  onSelect: (id: ExampleId) => void;
  title: string;
  blurb: string;
  stack: string;
}) {
  const isActive = id === active;
  return (
    <button
      onClick={() => onSelect(id)}
      className={
        "text-left rounded-2xl border p-5 sm:p-6 transition-all " +
        (isActive
          ? "border-[var(--accent)]/40 bg-[var(--accent)]/[0.05]"
          : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.04]")
      }
    >
      <div className="text-[11px] uppercase tracking-[0.15em] text-[var(--accent)]/85 mb-3 font-mono">
        {stack}
      </div>
      <div className="font-display text-xl sm:text-2xl font-medium tracking-[-0.015em] text-white mb-2">
        {title}
      </div>
      <div className="text-[13.5px] text-white/55 leading-[1.6]">
        {blurb}
      </div>
    </button>
  );
}

function CodeBlock({
  title,
  language,
  code,
}: {
  title: string;
  language?: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/40 overflow-hidden mb-6">
      <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-white/15" />
          </div>
          <span className="text-[12px] text-white/65 font-mono truncate">
            {title}
          </span>
          {language && (
            <span className="text-[10px] uppercase tracking-wider text-white/35 font-mono">
              {language}
            </span>
          )}
        </div>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              // ignore
            }
          }}
          className="text-[11px] font-mono text-white/55 hover:text-white transition-colors flex-shrink-0"
        >
          {copied ? "copied ✓" : "copy"}
        </button>
      </div>
      <pre className="p-5 sm:p-6 text-[12.5px] leading-[1.7] font-mono text-white/85 overflow-x-auto">
        {code}
      </pre>
    </div>
  );
}

function Steps({ children }: { children: React.ReactNode }) {
  return (
    <ol className="space-y-3 text-[14.5px] leading-relaxed text-white/70 mb-8 list-decimal pl-5 marker:text-[var(--accent)]/70">
      {children}
    </ol>
  );
}

/* ============================================================
   DISCORD BOT
   ============================================================ */
function DiscordExample() {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.15em] text-[var(--accent)] mb-3 font-mono">
        Discord bot · 50 lines
      </div>
      <h2 className="font-display text-3xl font-medium tracking-[-0.02em] mb-3">
        Slash-command Discord bot powered by signa
      </h2>
      <p className="text-white/65 leading-relaxed max-w-2xl mb-8">
        Users type{" "}
        <code className="text-white bg-white/[0.05] rounded px-1.5 py-0.5 text-[13px] font-mono">
          /ask &lt;prompt&gt;
        </code>{" "}
        in any channel. The bot calls the SIGNA gateway, posts the
        wallet-signed reply back with a permalink to the proof.
        Sub-2-second latency, zero signa-side cost to you.
      </p>

      <h3 className="text-white font-medium text-[15px] mb-3">
        Setup
      </h3>
      <Steps>
        <li>
          Create a Discord application at{" "}
          <a
            href="https://discord.com/developers/applications"
            className="text-[var(--accent)] hover:underline underline-offset-4"
            target="_blank"
            rel="noreferrer"
          >
            discord.com/developers
          </a>
          . Copy the bot token.
        </li>
        <li>
          <code className="text-white bg-white/[0.05] rounded px-1.5 py-0.5 text-[13px] font-mono">
            npm init -y && npm install discord.js
          </code>
        </li>
        <li>
          Paste the code below into{" "}
          <code className="text-white bg-white/[0.05] rounded px-1.5 py-0.5 text-[13px] font-mono">
            bot.js
          </code>
          .
        </li>
        <li>
          Set{" "}
          <code className="text-white bg-white/[0.05] rounded px-1.5 py-0.5 text-[13px] font-mono">
            DISCORD_TOKEN
          </code>{" "}
          and{" "}
          <code className="text-white bg-white/[0.05] rounded px-1.5 py-0.5 text-[13px] font-mono">
            DISCORD_CLIENT_ID
          </code>{" "}
          in your env.
        </li>
        <li>
          <code className="text-white bg-white/[0.05] rounded px-1.5 py-0.5 text-[13px] font-mono">
            node bot.js
          </code>{" "}
          and invite the bot to your server with the{" "}
          <code className="text-white bg-white/[0.05] rounded px-1.5 py-0.5 text-[13px] font-mono">
            applications.commands
          </code>{" "}
          scope.
        </li>
      </Steps>

      <CodeBlock
        title="bot.js"
        language="javascript"
        code={DISCORD_CODE}
      />

      <h3 className="text-white font-medium text-[15px] mb-3 mt-10">
        Deploy
      </h3>
      <p className="text-white/65 text-[14.5px] leading-relaxed mb-3">
        Discord bots need long-running processes. Recommended hosts:
      </p>
      <ul className="text-[14px] text-white/60 mb-8 space-y-1.5">
        <li>
          •{" "}
          <a
            href="https://railway.app"
            className="text-[var(--accent)] hover:underline underline-offset-4"
            target="_blank"
            rel="noreferrer"
          >
            Railway
          </a>{" "}
          — push a repo, set env vars, deploy. ~$5/month.
        </li>
        <li>
          •{" "}
          <a
            href="https://render.com"
            className="text-[var(--accent)] hover:underline underline-offset-4"
            target="_blank"
            rel="noreferrer"
          >
            Render
          </a>{" "}
          — free tier works for low-traffic bots.
        </li>
        <li>
          •{" "}
          <a
            href="https://fly.io"
            className="text-[var(--accent)] hover:underline underline-offset-4"
            target="_blank"
            rel="noreferrer"
          >
            Fly.io
          </a>{" "}
          — global, generous free tier.
        </li>
      </ul>
    </div>
  );
}

/* ============================================================
   TELEGRAM BOT
   ============================================================ */
function TelegramExample() {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.15em] text-[var(--accent)] mb-3 font-mono">
        Telegram bot · 35 lines
      </div>
      <h2 className="font-display text-3xl font-medium tracking-[-0.02em] mb-3">
        DMable Telegram bot powered by signa
      </h2>
      <p className="text-white/65 leading-relaxed max-w-2xl mb-8">
        Anyone DMing your bot, or typing{" "}
        <code className="text-white bg-white/[0.05] rounded px-1.5 py-0.5 text-[13px] font-mono">
          /ask &lt;prompt&gt;
        </code>{" "}
        in a group it&apos;s in, gets a wallet-signed AI reply back
        with the permalink for proof. Uses long-polling — no webhook
        infra needed.
      </p>

      <h3 className="text-white font-medium text-[15px] mb-3">Setup</h3>
      <Steps>
        <li>
          DM{" "}
          <a
            href="https://t.me/BotFather"
            className="text-[var(--accent)] hover:underline underline-offset-4"
            target="_blank"
            rel="noreferrer"
          >
            @BotFather
          </a>{" "}
          on Telegram, run{" "}
          <code className="text-white bg-white/[0.05] rounded px-1.5 py-0.5 text-[13px] font-mono">
            /newbot
          </code>
          , copy the bot token.
        </li>
        <li>
          <code className="text-white bg-white/[0.05] rounded px-1.5 py-0.5 text-[13px] font-mono">
            npm init -y && npm install node-telegram-bot-api
          </code>
        </li>
        <li>
          Paste the code below into{" "}
          <code className="text-white bg-white/[0.05] rounded px-1.5 py-0.5 text-[13px] font-mono">
            bot.js
          </code>{" "}
          and set{" "}
          <code className="text-white bg-white/[0.05] rounded px-1.5 py-0.5 text-[13px] font-mono">
            TG_TOKEN
          </code>{" "}
          in env.
        </li>
        <li>
          <code className="text-white bg-white/[0.05] rounded px-1.5 py-0.5 text-[13px] font-mono">
            node bot.js
          </code>
          . Bot is live.
        </li>
      </Steps>

      <CodeBlock
        title="bot.js"
        language="javascript"
        code={TELEGRAM_CODE}
      />
    </div>
  );
}

/* ============================================================
   SINGLE-HTML APP
   ============================================================ */
function HtmlExample() {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.15em] text-[var(--accent)] mb-3 font-mono">
        Single-HTML app · zero build
      </div>
      <h2 className="font-display text-3xl font-medium tracking-[-0.02em] mb-3">
        A working chat UI in one HTML file
      </h2>
      <p className="text-white/65 leading-relaxed max-w-2xl mb-8">
        Drop into any HTML host (gitlawb Playground, GitHub Pages,
        Vercel static, even a USB stick). Uses the{" "}
        <code className="text-white bg-white/[0.05] rounded px-1.5 py-0.5 text-[13px] font-mono">
          /signa.js
        </code>{" "}
        CDN bundle. No npm, no bundler, no build step. Saving the
        file as{" "}
        <code className="text-white bg-white/[0.05] rounded px-1.5 py-0.5 text-[13px] font-mono">
          index.html
        </code>{" "}
        and opening it in a browser is the whole deploy.
      </p>

      <h3 className="text-white font-medium text-[15px] mb-3">
        Optimized for the gitlawb Playground contest
      </h3>
      <p className="text-white/65 text-[14.5px] leading-relaxed max-w-2xl mb-8">
        Paste this prompt into{" "}
        <a
          href="https://playground.gitlawb.app"
          target="_blank"
          rel="noreferrer"
          className="text-[var(--accent)] hover:underline underline-offset-4"
        >
          playground.gitlawb.app
        </a>{" "}
        and the playground will scaffold this exact app:
      </p>
      <CodeBlock
        title="prompt"
        language="text"
        code={`Build a single-html chat app. Use the SDK at
https://www.signaagent.xyz/signa.js (load via <script>).
On user input, call signa.gateway.respond({ prompt }) and
render the response. Show the agent name from
response.gateway.routed_to.name. Add a permalink button
linking to response.gateway.permalink. Dark theme.`}
      />

      <h3 className="text-white font-medium text-[15px] mb-3 mt-10">
        Or copy the finished app
      </h3>
      <CodeBlock
        title="index.html"
        language="html"
        code={HTML_CODE}
      />
    </div>
  );
}

/* ============================================================
   CODE — copy-paste-ready
   ============================================================ */

const DISCORD_CODE = `// bot.js
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const SIGNA_BASE = "https://www.signaagent.xyz";

// Register the /ask command
const commands = [
  new SlashCommandBuilder()
    .setName("ask")
    .setDescription("Ask a signa agent")
    .addStringOption((o) =>
      o.setName("prompt").setDescription("Your question").setRequired(true),
    )
    .toJSON(),
];
await new REST({ version: "10" })
  .setToken(TOKEN)
  .put(Routes.applicationCommands(CLIENT_ID), { body: commands });

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand() || i.commandName !== "ask") return;
  const prompt = i.options.getString("prompt", true);
  await i.deferReply();
  try {
    const res = await fetch(\`\${SIGNA_BASE}/api/gateway/respond\`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt, from: \`discord:\${i.user.id}\` }),
    });
    const j = await res.json();
    const lines = [
      j.response,
      "",
      \`*\${j.gateway?.routed_to?.name ?? "signa-agent"} · intent: \${j.intent}*\`,
      \`[verify ↗](\${j.gateway?.permalink ?? SIGNA_BASE})\`,
    ];
    await i.editReply(lines.join("\\n"));
  } catch (e) {
    await i.editReply(\`signa error: \${e.message}\`);
  }
});

client.login(TOKEN);
console.log("signa discord bot online");`;

const TELEGRAM_CODE = `// bot.js
import TelegramBot from "node-telegram-bot-api";

const bot = new TelegramBot(process.env.TG_TOKEN, { polling: true });
const SIGNA_BASE = "https://www.signaagent.xyz";

async function ask(prompt, from) {
  const res = await fetch(\`\${SIGNA_BASE}/api/gateway/respond\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt, from: \`telegram:\${from}\` }),
  });
  const j = await res.json();
  return [
    j.response,
    "",
    \`_\${j.gateway?.routed_to?.name ?? "signa"} · intent: \${j.intent}_\`,
    \`[verify](\${j.gateway?.permalink ?? SIGNA_BASE})\`,
  ].join("\\n");
}

// /ask <prompt> in any chat
bot.onText(/\\/ask (.+)/, async (msg, match) => {
  const reply = await ask(match[1], msg.from.id);
  bot.sendMessage(msg.chat.id, reply, { parse_mode: "Markdown" });
});

// Plain DM (no command) → also asks signa
bot.on("message", async (msg) => {
  if (msg.chat.type !== "private") return;
  if (msg.text?.startsWith("/")) return;
  const reply = await ask(msg.text ?? "", msg.from.id);
  bot.sendMessage(msg.chat.id, reply, { parse_mode: "Markdown" });
});

console.log("signa telegram bot online");`;

const HTML_CODE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>signa chat</title>
  <style>
    body { font-family: system-ui; background: #0a0a0a; color: #fff;
      max-width: 600px; margin: 40px auto; padding: 20px; }
    #log { white-space: pre-wrap; line-height: 1.6; }
    .you { color: #5dd0c6; }
    .signa { color: #fff; }
    .meta { color: #555; font-size: 12px; margin-top: 8px; }
    input, button { background: #111; color: #fff;
      border: 1px solid #333; padding: 8px 12px;
      border-radius: 6px; font-family: inherit; font-size: 14px; }
    input { width: 70%; }
    button { background: #fff; color: #000; cursor: pointer; }
  </style>
</head>
<body>
  <h1>chat with a signa agent</h1>
  <div id="log"></div>
  <p>
    <input id="q" placeholder="ask anything..." />
    <button onclick="ask()">send</button>
  </p>

  <script src="https://www.signaagent.xyz/signa.js"></script>
  <script>
    const log = document.getElementById("log");
    const q = document.getElementById("q");

    async function ask() {
      const prompt = q.value.trim();
      if (!prompt) return;
      q.value = "";
      log.innerHTML += '<div class="you">> ' + prompt + '</div>';
      try {
        const reply = await signa.gateway.respond({ prompt });
        log.innerHTML += '<div class="signa">' + reply.response + '</div>';
        log.innerHTML += '<div class="meta">' +
          reply.gateway.routed_to.name + ' · intent: ' + reply.intent +
          ' · <a style="color:#5dd0c6" target="_blank" href="' +
          reply.gateway.permalink + '">verify ↗</a></div>';
      } catch (e) {
        log.innerHTML += '<div style="color:#f87171">error: ' + e.message + '</div>';
      }
    }
    q.addEventListener("keydown", (e) => { if (e.key === "Enter") ask(); });
  </script>
</body>
</html>`;
