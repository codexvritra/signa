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
  grant: { dot: "#8a8a86", label: "GRANT" },
  spend: { dot: "#3fd48b", label: "SPEND" },
  ask: { dot: "#d4a72c", label: "ASKS FOR $" },
  receipt: { dot: "#3fd48b", label: "x402 RECEIPT" },
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
    <div style={{ marginTop: 36 }}>
      <div className="panel">
        <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="stat-cell">
            <div className="n">{t ? `$${usd(t.granted_raw)}` : "—"}</div>
            <div className="l">budgets granted</div>
          </div>
          <div className="stat-cell">
            <div className="n">{t ? `$${usd(t.spent_raw)}` : "—"}</div>
            <div className="l">spent (signed)</div>
          </div>
          <div className="stat-cell">
            <div className="n">{t ? `$${usd(t.requested_raw)}` : "—"}</div>
            <div className="l">requested</div>
          </div>
          <div className="stat-cell">
            <div className="n">{t ? `$${usd(t.receipts_volume_raw)}` : "—"}</div>
            <div className="l">receipt volume</div>
          </div>
          <div className="stat-cell">
            <div className="n">{t ? String(t.agents_funded) : "—"}</div>
            <div className="l">agents funded</div>
          </div>
          <div className="stat-cell">
            <div className="n">{t ? String(t.receipts) : "—"}</div>
            <div className="l">x402 receipts</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 28, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Live ledger</div>
        <div style={{ fontSize: 11.5, color: "var(--ink-faint)", display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--mono)" }}>
          <span style={{ color: err ? "var(--down)" : "var(--accent)" }}>●</span>
          {err ? `error: ${err}` : updated ? `refreshed ${updated}` : "loading…"}
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: "0.8px", background: "var(--line)", border: "0.8px solid var(--line)" }}>
        {(d?.feed ?? []).map((e: any, i: number) => {
          const tone = TONE[e.type] ?? TONE.spend;
          return (
            <div
              key={i}
              style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 15px", background: "var(--paper)" }}
            >
              <span style={{ marginTop: 2, color: tone.dot, flexShrink: 0, fontSize: 9 }}>●</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: tone.dot }}>
                    {tone.label}
                  </span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-faint)" }}>{e.who}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>${usd(e.amount_raw)}</span>
                  <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }} className="truncate">{e.label}</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                {e.link && (
                  <a href={e.link} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "var(--accent)" }}>receipt →</a>
                )}
                <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>{ago(e.ts)}</span>
              </div>
            </div>
          );
        })}
        {d && (d.feed ?? []).length === 0 && <div style={{ fontSize: 13.5, color: "var(--ink-soft)", padding: "24px 0", textAlign: "center", background: "var(--paper)" }}>no activity yet</div>}
      </div>
    </div>
  );
}
