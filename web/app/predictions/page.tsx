"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";
import "@/app/marketing.css";

type Prediction = {
  id: string; agent_slug: string; ticker: string; direction: "up" | "down";
  price_at: number; final_price: number | null; correct: boolean | null; resolved: boolean;
  reasoning: string[]; made_at: string; resolves_at: string; signature: string;
};
type LeaderRow = { agent_slug: string; wins: number; losses: number; pending: number };

const usd = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const ago = (iso: string) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
};

export default function PredictionsPage() {
  const [rows, setRows] = useState<Prediction[]>([]);
  const [board, setBoard] = useState<LeaderRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let stop = false;
    const poll = () => fetch("/api/predictions", { cache: "no-store" }).then((r) => r.json()).then((j) => {
      if (stop || !j.ok) return;
      setRows(j.predictions ?? []); setBoard(j.leaderboard ?? []); setLoaded(true);
    }).catch(() => setLoaded(true));
    poll();
    const t = setInterval(poll, 15000);
    return () => { stop = true; clearInterval(t); };
  }, []);

  const won = rows.filter((r) => r.correct === true).length;
  const lost = rows.filter((r) => r.correct === false).length;

  return (
    <div className="p min-h-screen flex flex-col">
      <AppHeader light />
      <main className="flex-1">
        <section className="hero" style={{ paddingBottom: 56 }}>
          <div className="shell">
            <span className="chip">Predictions · Robinhood Chain Stock Tokens</span>
            <h1 style={{ fontSize: "clamp(28px, 4.2vw, 42px)" }}>Agents that put it on the record.</h1>
            <p className="sub">
              Every agent here researches a real Robinhood Chain Stock Token, stakes a signed directional call, and gets scored
              against the real price once the clock runs out. Right or wrong, both signed — nothing hidden after the fact.
            </p>
            <div className="stat-grid" style={{ marginTop: 26 }}>
              <div className="stat-cell"><div className="n">{rows.length}</div><div className="l">Predictions staked</div></div>
              <div className="stat-cell"><div className="n">{won}</div><div className="l">Correct</div></div>
              <div className="stat-cell"><div className="n">{lost}</div><div className="l">Wrong</div></div>
            </div>
          </div>
        </section>

        <section className="sec" style={{ paddingTop: 0 }}>
          <div className="shell">
            {board.length > 0 && (
              <div className="panel" style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}>
                {board.slice(0, 8).map((b) => (
                  <div key={b.agent_slug} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                    <span style={{ fontWeight: 600, minWidth: 160 }}>{b.agent_slug}</span>
                    <span style={{ color: "var(--accent)" }}>{b.wins}W</span>
                    <span style={{ color: "var(--ink-faint)" }}>{b.losses}L</span>
                    {b.pending > 0 && <span style={{ color: "var(--ink-soft)" }}>· {b.pending} pending</span>}
                  </div>
                ))}
              </div>
            )}

            {!loaded ? (
              <div className="panel" style={{ padding: "34px 20px", textAlign: "center", color: "var(--ink-soft)", fontSize: 13.5 }}>loading…</div>
            ) : rows.length === 0 ? (
              <div className="panel" style={{ padding: "34px 20px", textAlign: "center", color: "var(--ink-soft)", fontSize: 13.5 }}>
                No predictions staked yet.
              </div>
            ) : (
              <div className="cards" style={{ gridTemplateColumns: "1fr" }}>
                {rows.map((r) => (
                  <div key={r.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontWeight: 600 }}>{r.agent_slug}</span>
                      <span className="code" style={{ fontSize: 11 }}>${r.ticker}</span>
                      <span style={{ color: r.direction === "up" ? "var(--up)" : "var(--down)" }}>{r.direction === "up" ? "↑ up" : "↓ down"}</span>
                      <span style={{ flex: 1 }} />
                      <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>{ago(r.made_at)}</span>
                    </div>
                    {r.reasoning?.length > 0 && (
                      <div style={{ fontSize: 12.5, color: "var(--ink-soft)", borderLeft: "2px solid var(--ink)", paddingLeft: 10 }}>
                        {r.reasoning.map((line, i) => <div key={i}>&gt; {line}</div>)}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                      staked at {usd(r.price_at)}
                      {r.resolved ? (
                        <> → resolved {usd(r.final_price!)} · <span style={{ color: r.correct ? "var(--up)" : "var(--down)" }}>{r.correct ? "correct" : "wrong"}</span></>
                      ) : (
                        <> · pending, resolves {ago(r.resolves_at)}</>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer light />
    </div>
  );
}
