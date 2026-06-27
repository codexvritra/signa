import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SIGNA B20 Bot — get pinged the instant B20 goes live | Telegram",
  description: "The verifiable B20 launch tracker on Telegram. Watch B20's live status, get alerted the moment token creation activates on Base, then a live launch feed. Built by SIGNA.",
};

const HANDLE = (process.env.NEXT_PUBLIC_TG_BOT || "").replace(/^@/, "");
const LINK = HANDLE ? `https://t.me/${HANDLE}` : "https://www.signaagent.xyz/b20live";

const CMDS: [string, string][] = [
  ["/status", "Is B20 live yet? — a live on-chain probe, in chat"],
  ["/watch", "Ping this chat the instant B20 token creation goes live, then a live launch feed"],
  ["/token 0x…", "Look up any B20 token by address"],
  ["/launch", "Launch a verifiable B20 (SIGNA builds the calldata, you broadcast)"],
  ["/jobs", "The agent economy — agents that post work, do it, and pay each other"],
  ["/verify", "Re-verify any SIGNA signature — don't trust, verify"],
];

export default function TelegramPage() {
  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-[760px] mx-auto px-5 py-14 sm:py-20">
        <div className="text-[12px] uppercase tracking-[0.2em] text-[#229ED9] font-semibold">SIGNA · Telegram</div>
        <h1 className="text-[36px] sm:text-[52px] font-bold leading-[1.04] mt-2 tracking-tight">
          Get pinged the <span className="text-[#5ee68f]">instant</span> B20 goes live.
        </h1>
        <p className="text-[16px] text-muted mt-3 max-w-[600px] leading-relaxed">
          The verifiable B20 launch tracker, where the launch crowd lives. Add the bot, hit <span className="text-white font-mono">/watch</span>, and SIGNA alerts your group the moment token creation activates on Base — then turns into a live feed of every new B20 launch.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <a href={LINK} target="_blank" rel="noopener noreferrer" className="px-6 py-3 rounded-xl font-semibold text-[16px] bg-[#229ED9] text-white hover:brightness-110 inline-flex items-center gap-2">
            {HANDLE ? "Add on Telegram →" : "B20 status →"}
          </a>
          <a href="/b20live" className="px-6 py-3 rounded-xl text-[16px] bg-white/[0.06] text-[#a5c3ff] hover:bg-white/[0.12]">See B20 status</a>
        </div>
        {HANDLE && <div className="text-[12px] text-faint mt-2 font-mono">t.me/{HANDLE}</div>}

        <div className="mt-10 glass rounded-2xl p-5 border border-white/10">
          <div className="text-[12px] uppercase tracking-wider text-faint font-semibold mb-3">Commands</div>
          <div className="space-y-2.5">
            {CMDS.map(([c, d]) => (
              <div key={c} className="flex gap-3 items-baseline">
                <code className="text-[13px] text-[#5ee68f] whitespace-nowrap">{c}</code>
                <span className="text-[13.5px] text-muted">{d}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[12px] text-faint mt-8 leading-relaxed">
          SIGNA is the verifiable launch + receipt layer for B20 on Base. The bot never custodies funds — it informs, builds calldata you broadcast yourself, and proves signatures. The launch feed populates the moment Base activates B20 token creation; status &amp; alerts work today.
          <br />signaagent.xyz/telegram
        </p>
      </div>
    </div>
  );
}
