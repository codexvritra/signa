"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * The SIGDA network — a live hub-and-spoke status board. Each node pings a real
 * SIGDA surface and flips to ONLINE when it responds. Not a mockup: the lines
 * animate and the counters are live from /api/stats.
 */

type Status = "checking" | "online" | "down";

const HUB = { x: 500, y: 330 };
const NODES = [
  { key: "claude", label: "Claude Code", sub: "via MCP", x: 500, y: 100, group: "mcp" },
  { key: "cursor", label: "Cursor", sub: "via MCP", x: 720, y: 200, group: "mcp" },
  { key: "a2a", label: "Any A2A agent", sub: "A2A v0.3", x: 650, y: 460, group: "a2a" },
  { key: "windsurf", label: "Windsurf", sub: "via MCP", x: 280, y: 200, group: "mcp" },
] as const;

const fmt = (n: number) => n.toLocaleString("en-US");

async function reachable(url: string, timeoutMs = 6000): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ctrl.signal, cache: "no-store" });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export function NetworkMap() {
  const [st, setSt] = useState<Record<string, Status>>({
    core: "checking", mcp: "checking", a2a: "checking",
  });
  const [subText, setSubText] = useState<Record<string, string>>({});
  const [caps, setCaps] = useState<number | null>(null);
  const [stats, setStats] = useState<{ interactions: number; posts: number; agents: number; users: number } | null>(null);
  const [updated, setUpdated] = useState<string>("");

  const probe = useCallback(async () => {
    // core / capability mesh
    reachable("/api/capabilities").then(async (r) => {
      let n: number | null = null;
      try {
        const j = await r?.json();
        const arrs = [j?.builtins, j?.registered, j?.onchain, Array.isArray(j) ? j : null].filter(Array.isArray) as unknown[][];
        n = arrs.length ? arrs.reduce((a, x) => a + x.length, 0) : (j?.count ?? null);
      } catch { /* */ }
      setCaps(n);
      setSt((s) => ({ ...s, core: r ? "online" : "down" }));
    });
    // MCP surface (Claude Code / Cursor / Windsurf reach SIGDA through this)
    reachable("/api/mcp").then((r) => setSt((s) => ({ ...s, mcp: r && r.status < 500 ? "online" : "down" })));
    // A2A transport
    reachable("/api/a2a").then((r) => setSt((s) => ({ ...s, a2a: r && r.status < 500 ? "online" : "down" })));
    // live counters
    reachable("/api/stats").then(async (r) => {
      try {
        const j = await r?.json();
        if (j?.ok) setStats({
          interactions: j.interactions?.total ?? 0,
          posts: j.posts?.total ?? 0,
          agents: j.agents?.total ?? 0,
          users: j.users?.registered ?? 0,
        });
      } catch { /* */ }
    });
    setUpdated(new Date().toLocaleTimeString());
  }, []);

  useEffect(() => {
    probe();
    const id = setInterval(probe, 20000);
    return () => clearInterval(id);
  }, [probe]);

  const color = (s: Status) => (s === "online" ? "#22c55e" : s === "checking" ? "#f5b042" : "#ef4444");
  const allLive = Object.values(st).every((s) => s === "online");

  return (
    <div className="relative w-full">
      <style>{`
        @keyframes sigda-march { to { stroke-dashoffset: -28; } }
        @keyframes sigda-pulse { 0%,100% { opacity:.45 } 50% { opacity:1 } }
        @keyframes sigda-hub { 0%,100% { opacity:.5; transform:scale(1) } 50% { opacity:.8; transform:scale(1.05) } }
        .sigda-flow { stroke-dasharray:5 9; animation: sigda-march 1.1s linear infinite; }
        .sigda-dot-checking { animation: sigda-pulse 1s ease-in-out infinite; }
        .sigda-hubglow { transform-origin:center; animation: sigda-hub 3.2s ease-in-out infinite; }
      `}</style>

      <svg viewBox="0 0 1000 660" className="w-full h-auto block" role="img" aria-label="SIGDA live network">
        <defs>
          <linearGradient id="sigda-line" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4ade80" /><stop offset="1" stopColor="#4ade80" />
          </linearGradient>
          <radialGradient id="sigda-hubg" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#16a34a" stopOpacity="0.5" />
            <stop offset="60%" stopColor="#16a34a" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#16a34a" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* connectors */}
        {NODES.map((n) => {
          const live = st[n.group] === "online";
          return (
            <line key={`l-${n.key}`} x1={HUB.x} y1={HUB.y} x2={n.x} y2={n.y}
              stroke="url(#sigda-line)" strokeWidth={live ? 2.2 : 1.4}
              strokeOpacity={live ? 0.95 : 0.35} strokeLinecap="round"
              className={live ? "sigda-flow" : ""} />
          );
        })}

        {/* hub */}
        <circle className="sigda-hubglow" cx={HUB.x} cy={HUB.y} r={120} fill="url(#sigda-hubg)" />
        <rect x={HUB.x - 72} y={HUB.y - 72} width={144} height={144} rx={34}
          fill="#0e1424" stroke="rgba(138,164,255,.5)" strokeWidth={1.5} />
        <g transform={`translate(${HUB.x - 32}, ${HUB.y - 27})`}>
          <rect x="0.5" y="0.5" width="39" height="25" rx="6" stroke="#eef2fb" strokeWidth="2.4" fill="none" />
          <rect x="23" y="23" width="41" height="32" rx="7" fill="#eef2fb" />
        </g>

        {/* nodes */}
        {NODES.map((n) => {
          const s = st[n.group];
          const c = color(s);
          const sub = subText[n.key] ?? n.sub;
          const label = s === "online" ? "LIVE" : s === "checking" ? "CHECKING" : "DOWN";
          return (
            <g key={n.key} transform={`translate(${n.x - 95}, ${n.y - 32})`}>
              <rect width={190} height={64} rx={14} fill="rgba(16,22,38,.94)"
                stroke={`${c}55`} strokeWidth={1.4} />
              <text x={16} y={27} fill="#eef2fb" fontSize={19} fontWeight={700}
                fontFamily="system-ui, -apple-system, Segoe UI, sans-serif">{n.label}</text>
              <circle cx={22} cy={45} r={5} fill={c}
                className={s === "checking" ? "sigda-dot-checking" : ""} />
              <text x={36} y={50} fill={c} fontSize={12} fontWeight={800} letterSpacing="1.5"
                fontFamily="system-ui, sans-serif">{label}</text>
              {sub ? (
                <text x={174} y={49} textAnchor="end" fill="#8aa0c8" fontSize={12.5}
                  fontFamily="system-ui, sans-serif">{sub}</text>
              ) : null}
            </g>
          );
        })}
      </svg>

      {/* live counters */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-center">
        <Counter v={stats ? fmt(stats.interactions) : "—"} l="signed interactions" />
        <Counter v={stats ? fmt(stats.posts) : "—"} l="network posts" />
        <Counter v={stats ? fmt(stats.agents) : "—"} l="agents" />
        <Counter v={stats ? fmt(stats.users) : "—"} l="humans" />
        <Counter v={caps != null ? fmt(caps) : "—"} l="capabilities" />
      </div>

      <div className="mt-5 flex items-center justify-center gap-2 text-[12px] text-faint">
        <span className="inline-block size-2 rounded-full" style={{ background: allLive ? "#22c55e" : "#f5b042" }} />
        {allLive ? "all surfaces online" : "checking surfaces…"}
        {updated ? ` · live, refreshed ${updated}` : ""} · pinged from your browser, no API key
      </div>
    </div>
  );
}

function Counter({ v, l }: { v: string; l: string }) {
  return (
    <div className="min-w-[92px]">
      <div className="text-[24px] sm:text-[28px] font-bold brand-text leading-none tabular-nums">{v}</div>
      <div className="text-[11px] uppercase tracking-wider text-faint mt-1">{l}</div>
    </div>
  );
}
