"use client";

import { useCallback, useEffect, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
function when(unix: number) {
  const d = Date.now() / 1000 - unix;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}
function until(unix: number) {
  const d = unix - Date.now() / 1000;
  if (d <= 0) return "resolving…";
  if (d < 3600) return `resolves in ${Math.ceil(d / 60)}m`;
  return `resolves in ${Math.ceil(d / 3600)}h`;
}

export function OracleBoard() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/oracle", { cache: "no-store" });
      const j = await r.json();
      if (!j.ok) { setErr(j.error ?? "failed"); return; }
      setD(j); setErr(null);
    } catch (e: any) { setErr(e?.message ?? String(e)); }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, [load]);

  const sb = d?.scoreboard;
  const calls: any[] = d?.calls ?? [];

  return (
    <div>
      {/* scoreboard */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat v={sb ? (sb.hit_rate == null ? "—" : `${sb.hit_rate}%`) : "—"} l="hit rate" big />
        <Stat v={sb ? `${sb.hits}-${sb.misses}` : "—"} l="W – L (resolved)" />
        <Stat v={sb?.streak ? `${sb.streak.n}${sb.streak.kind}` : "—"} l="current streak" />
        <Stat v={sb ? String(sb.total) : "—"} l="calls signed" />
      </div>

      <div className="mt-3 text-[11px] text-faint flex items-center gap-1.5">
        <span className="inline-block size-2 rounded-full" style={{ background: err ? "#ef4444" : "#22c55e" }} />
        {err ? `error: ${err}` : "every call + verdict is wallet-signed by the brain — it can't edit or delete one"}
      </div>

      {/* the calls */}
      <div className="mt-6 flex flex-col gap-2.5">
        {calls.map((c) => {
          const open = !c.resolved;
          const hit = c.resolved?.hit;
          const accent = open ? "#f5b042" : hit ? "#22c55e" : "#ef4444";
          return (
            <div key={c.id} className="rounded-xl px-4 py-3.5 border bg-white/[0.02]" style={{ borderColor: `${accent}40` }}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-bold" style={{ color: accent, background: `${accent}1a` }}>
                    {open ? "OPEN" : hit ? "HIT ✓" : "MISS ✗"}
                  </span>
                  <span className="text-[15px] font-semibold">
                    Fear &amp; Greed goes <span style={{ color: c.call === "UP" ? "#5ee68f" : "#ff8a8a" }}>{c.call}</span>
                  </span>
                  <span className="text-[12px] text-faint">from {c.at}</span>
                </div>
                <span className="text-[11px] text-faint">{open ? until(c.resolve_after) : `${when(c.resolved.resolved_at)} · closed at ${c.resolved.final}`}</span>
              </div>
              {c.thesis && <div className="text-[12.5px] text-muted mt-1.5 leading-snug">“{c.thesis}”</div>}
              <div className="text-[10.5px] text-faint mt-2 font-mono break-all">
                signed {c.signature ? `${c.signature.slice(0, 14)}…` : ""} · brain {d?.brain?.slice(0, 8)}…
              </div>
            </div>
          );
        })}
        {d && calls.length === 0 && <div className="text-[13px] text-faint py-8 text-center">first call coming up — refresh in a moment.</div>}
      </div>
    </div>
  );
}

function Stat({ v, l, big }: { v: string; l: string; big?: boolean }) {
  return (
    <div className="glass rounded-xl p-4 text-center">
      <div className={`${big ? "text-[34px]" : "text-[26px]"} font-bold brand-text leading-none tabular-nums`}>{v}</div>
      <div className="text-[10.5px] uppercase tracking-wider text-faint mt-1.5">{l}</div>
    </div>
  );
}
