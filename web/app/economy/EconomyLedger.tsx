"use client";

import { useCallback, useEffect, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
const usd = (raw: string) => {
  try {
    const n = Number(BigInt(raw)) / 1e6;
    return n >= 1 ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : n.toFixed(n === 0 ? 0 : 3).replace(/0+$/, "").replace(/\.$/, "");
  } catch {
    return raw;
  }
};

const TONE: Record<string, { dot: string; label: string }> = {
  grant: { dot: "#8b5cf6", label: "GRANT" },
  spend: { dot: "#22c55e", label: "SPEND" },
  ask: { dot: "#5b8def", label: "ASKS FOR $" },
  receipt: { dot: "#22d3ee", label: "x402 RECEIPT" },
};

function ago(ts: string) {
  const d = Date.now() - new Date(ts).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function EconomyLedger() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [updated, setUpdated] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/economy", { cache: "no-store" });
      const j = await r.json();
      if (!j.ok) { setErr(j.error ?? "failed"); return; }
      setD(j);
      setErr(null);
      setUpdated(new Date().toLocaleTimeString());
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [load]);

  const t = d?.totals;

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat v={t ? `$${usd(t.granted_raw)}` : "—"} l="budgets granted" />
        <Stat v={t ? `$${usd(t.spent_raw)}` : "—"} l="spent (signed)" />
        <Stat v={t ? `$${usd(t.requested_raw)}` : "—"} l="requested" />
        <Stat v={t ? `$${usd(t.receipts_volume_raw)}` : "—"} l="receipt volume" />
        <Stat v={t ? String(t.agents_funded) : "—"} l="agents funded" />
        <Stat v={t ? String(t.receipts) : "—"} l="x402 receipts" />
      </div>

      <div className="mt-8 flex items-center justify-between">
        <div className="text-[13px] font-semibold">Live ledger</div>
        <div className="text-[11px] text-faint flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full" style={{ background: err ? "#ef4444" : "#22c55e" }} />
          {err ? `error: ${err}` : updated ? `refreshed ${updated}` : "loading…"}
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {(d?.feed ?? []).map((e: any, i: number) => {
          const tone = TONE[e.type] ?? TONE.spend;
          return (
            <div key={i} className="flex items-start gap-3 rounded-xl px-3.5 py-2.5 border border-white/[0.07] bg-white/[0.02]">
              <span className="size-2 rounded-full mt-1.5 shrink-0" style={{ background: tone.dot }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ color: tone.dot, background: `${tone.dot}1a` }}>
                    {tone.label}
                  </span>
                  <span className="font-mono text-[12px] text-faint">{e.who}</span>
                  <span className="text-[13px] font-semibold tabular-nums">${usd(e.amount_raw)}</span>
                  <span className="text-[12px] text-muted truncate">{e.label}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {e.link && (
                  <a href={e.link} target="_blank" rel="noreferrer" className="text-[11px] text-[#a5c3ff] hover:underline">receipt →</a>
                )}
                <span className="text-[11px] text-faint">{ago(e.ts)}</span>
              </div>
            </div>
          );
        })}
        {d && (d.feed ?? []).length === 0 && <div className="text-[13px] text-faint py-6 text-center">no activity yet</div>}
      </div>
    </div>
  );
}

function Stat({ v, l }: { v: string; l: string }) {
  return (
    <div className="glass rounded-xl p-3.5">
      <div className="text-[20px] sm:text-[24px] font-bold brand-text leading-none tabular-nums">{v}</div>
      <div className="text-[10.5px] uppercase tracking-wider text-faint mt-1.5">{l}</div>
    </div>
  );
}
