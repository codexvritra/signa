"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * PumpNotifications — live toast popups for launchpad activity (buys, sells,
 * new launches, graduations). Polls /api/pump/activity, seeds the seen-set on
 * first load (no historical spam), then pops a toast for each new event.
 * SIGNA's own component; standard live-activity pattern.
 */
type Item = { kind: "buy" | "sell" | "launch" | "graduate"; token: string; actor: string; eth: string; ts: number; tx: string; symbol?: string; image_url?: string };
type Toast = { id: string; item: Item };

const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
const eth = (wei: string) => { try { return (Number(BigInt(wei)) / 1e18).toFixed(4); } catch { return "0"; } };

function line(i: Item): { icon: string; text: string; color: string } {
  const sym = i.symbol ? `$${i.symbol}` : short(i.token);
  if (i.kind === "buy") return { icon: "🟢", color: "#5ee68f", text: `${short(i.actor)} bought ${eth(i.eth)} ETH of ${sym}` };
  if (i.kind === "sell") return { icon: "🔴", color: "#ff6b6b", text: `${short(i.actor)} sold ${sym} for ${eth(i.eth)} ETH` };
  if (i.kind === "launch") return { icon: "🚀", color: "#a98bff", text: `${sym} just launched` };
  return { icon: "🎓", color: "#6ea2ff", text: `${sym} graduated to Uniswap` };
}

export default function PumpNotifications() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const seeded = useRef(false);

  const poll = useCallback(async () => {
    try {
      const j = await (await fetch("/api/pump/activity", { cache: "no-store" })).json();
      if (!j.ok) return;
      const items: Item[] = j.activity ?? [];
      if (!seeded.current) { for (const i of items) seen.current.add(i.tx + i.kind); seeded.current = true; return; }
      const fresh = items.filter((i) => !seen.current.has(i.tx + i.kind)).reverse();
      if (!fresh.length) return;
      for (const i of fresh) seen.current.add(i.tx + i.kind);
      setToasts((prev) => [...fresh.map((item) => ({ id: item.tx + item.kind, item })), ...prev].slice(0, 4));
      for (const i of fresh) {
        const id = i.tx + i.kind;
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 6500);
      }
    } catch {}
  }, []);
  useEffect(() => { poll(); const t = setInterval(poll, 7000); return () => clearInterval(t); }, [poll]);

  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-[calc(100vw-2rem)]">
      {toasts.map((t) => {
        const l = line(t.item);
        return (
          <a
            key={t.id}
            href={`/pump/${t.item.token}`}
            className="glass rounded-xl px-3.5 py-2.5 border border-white/10 shadow-lg flex items-center gap-2.5 min-w-[240px] animate-[slideIn_.2s_ease-out] hover:border-white/25"
            style={{ borderLeft: `3px solid ${l.color}` }}
          >
            {t.item.image_url ? (
              <img src={t.item.image_url} alt="" className="size-8 rounded-lg object-cover shrink-0" />
            ) : (
              <span className="text-[18px] shrink-0">{l.icon}</span>
            )}
            <span className="text-[13px] text-white/95 leading-snug">{l.text}</span>
          </a>
        );
      })}
      <style>{`@keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}`}</style>
    </div>
  );
}
