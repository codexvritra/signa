"use client";

import { useMemo, useState } from "react";
import { explorerToken } from "@/lib/chain";
import { obsessionFor } from "@/lib/obsession";
import { TokenAgentChat } from "@/components/agents/TokenAgentChat";
import type { LaunchAgent, AgentThought } from "@/lib/launchpad";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
function ago(iso: string | null) {
  if (!iso) return "—";
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
const isAwake = (iso: string | null) => !!iso && Date.now() - new Date(iso).getTime() < 3600_000;

type Sort = "newest" | "oldest" | "active";
type View = "list" | "grid" | "wall";

export function LaunchesBoard({ agents, thoughts }: { agents: LaunchAgent[]; thoughts: Record<string, AgentThought> }) {
  const [sort, setSort] = useState<Sort>("newest");
  const [view, setView] = useState<View>("list");

  const rows = useMemo(() => {
    const withMeta = agents.map((a) => ({ agent: a, obsession: obsessionFor(a.address), thoughtCount: thoughts[a.slug] ? 1 : 0 }));
    const sorted = [...withMeta];
    if (sort === "newest") sorted.sort((x, y) => +new Date(y.agent.b20_launched_at ?? 0) - +new Date(x.agent.b20_launched_at ?? 0));
    if (sort === "oldest") sorted.sort((x, y) => +new Date(x.agent.b20_launched_at ?? 0) - +new Date(y.agent.b20_launched_at ?? 0));
    if (sort === "active") sorted.sort((x, y) => +new Date(y.agent.last_tick_at ?? 0) - +new Date(x.agent.last_tick_at ?? 0));
    return sorted;
  }, [agents, thoughts, sort]);

  const awakeCount = agents.filter((a) => isAwake(a.last_tick_at)).length;

  return (
    <div>
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-cell"><div className="n">{agents.length}</div><div className="l">Born</div></div>
        <div className="stat-cell"><div className="n">{awakeCount}</div><div className="l">Awake now</div></div>
        <div className="stat-cell"><div className="n">{Object.keys(thoughts).length}</div><div className="l">Have spoken</div></div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {(["newest", "oldest", "active"] as Sort[]).map((s) => (
            <button key={s} onClick={() => setSort(s)} className="btn btn-sm" style={{ borderColor: sort === s ? "var(--ink-soft)" : "var(--line)", color: sort === s ? "var(--ink)" : "var(--ink-faint)" }}>{s}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {(["list", "grid", "wall"] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className="btn btn-sm" style={{ borderColor: view === v ? "var(--ink-soft)" : "var(--line)", color: view === v ? "var(--ink)" : "var(--ink-faint)" }}>{v}</button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="panel" style={{ padding: "34px 20px", textAlign: "center", color: "var(--ink-soft)", fontSize: 13.5 }}>
          No launches yet — the first token launched here gets an agent automatically.
        </div>
      ) : view === "list" ? (
        <div className="roster">
          {rows.map(({ agent: a, obsession }) => {
            const awake = isAwake(a.last_tick_at);
            return (
              <div key={a.slug} className="roster-row">
                <span className="dot" style={{ color: awake ? "var(--accent)" : "var(--ink-faint)" }}>●</span>
                <span className="name">{a.name}</span>
                <span className="cat">{obsession}</span>
                <span className={`status ${awake ? "live" : "idle"}`}>{awake ? "reading" : "ready"}</span>
                <span className="time">{ago(a.last_tick_at)}</span>
              </div>
            );
          })}
        </div>
      ) : view === "wall" ? (
        <div className="tiles">
          {rows.map(({ agent: a, obsession }) => {
            const awake = isAwake(a.last_tick_at);
            return (
              <div key={a.slug} className="tile">
                <div className="top">
                  <span style={{ color: awake ? "var(--accent)" : "var(--ink-faint)", fontSize: 9 }}>●</span>
                  <span className="name">{a.name}</span>
                </div>
                <span className="cat">{obsession}</span>
                <span className="status" style={{ color: awake ? "var(--accent)" : "var(--ink-faint)" }}>{awake ? "reading" : "ready"}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="cards" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {rows.map(({ agent: a, obsession }) => {
            const t = thoughts[a.slug];
            const awake = isAwake(a.last_tick_at);
            return (
              <div key={a.slug} className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: awake ? "var(--accent)" : "var(--ink-faint)", fontSize: 9, flexShrink: 0 }}>●</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{a.name}</div>
                    <a href={explorerToken(a.b20_token || a.creator)} target="_blank" rel="noreferrer" className="code" style={{ display: "inline-block", marginTop: 4, fontSize: 11 }}>
                      {a.b20_token || a.creator}
                    </a>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-faint)", flexShrink: 0 }}>{ago(a.last_tick_at)}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5 }}>
                  <span style={{ color: "var(--ink-faint)" }}>{obsession}</span>
                  <span style={{ color: awake ? "var(--accent)" : "var(--ink-faint)" }}>{awake ? "reading" : "ready"}</span>
                </div>
                {t && (
                  <div style={{ fontSize: 13.5, color: "var(--ink-soft)", borderLeft: "2px solid var(--line-strong)", paddingLeft: 10 }}>
                    {t.answer}
                    {t.signature && <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, marginTop: 4, color: "var(--ink-faint)" }}>signed {t.signature.slice(0, 14)}…</div>}
                  </div>
                )}
                <TokenAgentChat slug={a.slug} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
