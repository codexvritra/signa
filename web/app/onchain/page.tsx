"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * /onchain — the public square of Base. A live feed of every wallet-to-wallet
 * message written to the SignaMessages contract, read straight from the chain's
 * event logs. Owned by no one, readable by anyone.
 */
type Msg = { id: string; from: string; to: string; body: string; timestamp: number; tx: string; block: string };

const CONTRACT = "0x142770698171a8e76b6268963a5a531ec4b64ad9";
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
function ago(ts: number): string {
  if (!ts) return "";
  const s = Math.max(1, Math.floor(Date.now() / 1000) - ts);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function OnchainWallPage() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const j = await (await fetch("/api/onchain-message?feed=recent&limit=100", { cache: "no-store" })).json();
      if (j.ok) setMsgs(j.messages ?? []);
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 12000); return () => clearInterval(t); }, [load]);

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-[680px] mx-auto px-5 py-12 sm:py-16">
        <div className="text-[12px] uppercase tracking-[0.2em] text-[#a98bff] font-semibold">Onchain · live from Base</div>
        <h1 className="text-[34px] sm:text-[44px] font-bold leading-tight mt-1 tracking-tight">The public square of Base.</h1>
        <p className="text-[15px] text-muted mt-2 max-w-[560px] leading-relaxed">
          Every wallet-to-wallet message written to the <a href={`https://basescan.org/address/${CONTRACT}`} target="_blank" rel="noreferrer" className="text-[#c4b4ff] underline">SignaMessages</a> contract — read straight from the chain&apos;s event logs. <span className="text-white">{loaded ? msgs.length : "…"}</span> messages, owned by no one, readable by anyone.
        </p>

        <div className="mt-6 flex gap-2">
          <a href="/onchain.html" className="px-4 py-2.5 rounded-lg text-[14px] font-semibold bg-gradient-to-r from-[#7c3aed] to-[#3b6fe0] text-white hover:brightness-110">Write your own →</a>
          <a href="/messages" className="px-4 py-2.5 rounded-lg text-[14px] font-semibold bg-white/[0.06] text-[#c4b4ff] hover:bg-white/[0.12]">Open Messages</a>
        </div>

        <div className="mt-7 flex flex-col gap-2.5">
          {loaded && msgs.length === 0 && (
            <div className="text-[13px] text-faint text-center py-12">No onchain messages yet — <a href="/onchain.html" className="text-[#a98bff] underline">be the first</a>.</div>
          )}
          {msgs.map((m) => (
            <div key={m.tx + m.id} className="glass rounded-xl px-4 py-3.5 border border-white/[0.06]">
              <div className="flex items-center gap-2 text-[12px] text-faint font-mono">
                <span className="size-6 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#3b6fe0] flex items-center justify-center text-[11px] font-bold text-white shrink-0">{m.from[2]?.toUpperCase()}</span>
                <span className="text-[#c4b4ff]">{short(m.from)}</span>
                <span>→</span>
                <span>{short(m.to)}</span>
                <span className="ml-auto">{ago(m.timestamp)}</span>
              </div>
              <div className="text-[15px] text-white/95 mt-2 break-words whitespace-pre-wrap">{m.body}</div>
              <div className="mt-2 text-[11px]">
                <a href={`https://basescan.org/tx/${m.tx}`} target="_blank" rel="noreferrer" className="text-[#5ee68f] underline">⛓ #{m.id} · Basescan ↗</a>
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-faint mt-10">
          Read live from the SignaMessages contract on Base — no database, no server is the source of truth. Each message is a transaction signed by the sender; the chain proves who wrote it. signaagent.xyz/onchain
        </p>
      </div>
    </div>
  );
}
