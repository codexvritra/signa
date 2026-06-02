"use client";

import { useEffect, useState } from "react";

type Cap = {
  name: string;
  provider?: string;
  source?: string | null;
  description: string;
  price_usdc?: number;
  calls?: number;
  kind: string;
  invoke: string;
};

type Dir = {
  ok: boolean;
  builtins: Cap[];
  registered: Cap[];
  counts: { builtin: number; registered: number; advertised: number };
};

const short = (a?: string) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a ?? "");

function Row({ c, arg }: { c: Cap; arg?: string }) {
  const href = `/api/capabilities/invoke?cap=${encodeURIComponent(c.name)}${arg ? `&arg=${encodeURIComponent(arg)}` : ""}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="block border border-white/10 hover:border-white/25 transition-colors rounded-lg bg-white/[0.02] p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-[14px] text-[var(--accent)]">{c.name}</div>
        <div className="flex items-center gap-2 shrink-0">
          {typeof c.price_usdc === "number" && c.price_usdc > 0 ? (
            <span className="text-[11px] font-mono text-amber-300/90 border border-amber-300/25 rounded-full px-2 py-0.5">
              {c.price_usdc} USDC/call
            </span>
          ) : (
            <span className="text-[11px] font-mono text-white/40 border border-white/10 rounded-full px-2 py-0.5">free</span>
          )}
          {typeof c.calls === "number" && c.calls > 0 && (
            <span className="text-[11px] font-mono text-white/40">{c.calls} calls</span>
          )}
        </div>
      </div>
      <div className="text-[12.5px] text-white/60 leading-relaxed mt-1">{c.description}</div>
      <div className="text-[11px] text-white/35 mt-1.5 font-mono">
        {c.kind === "builtin" ? "built-in" : `by ${short(c.provider)}`}
        {c.source ? ` · ${c.source}` : ""} · invoke →
      </div>
    </a>
  );
}

export function MarketplaceDirectory() {
  const [dir, setDir] = useState<Dir | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/capabilities", { headers: { accept: "application/json" } })
      .then((r) => r.json())
      .then((j) => { if (alive) setDir(j); })
      .catch(() => { if (alive) setErr("could not load the directory"); });
    return () => { alive = false; };
  }, []);

  if (err) return <div className="text-[13px] text-white/50">{err}</div>;
  if (!dir) return <div className="text-[13px] text-white/40 font-mono animate-pulse">loading the live directory…</div>;

  const builtinArg = (n: string) => (n === "bankr.resolve" ? "@mac_eth" : undefined);

  return (
    <div className="space-y-10">
      <div>
        <div className="flex items-baseline justify-between mb-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--accent)]">
            registered by developers · the open marketplace
          </div>
          <div className="text-[12px] font-mono text-white/45">{dir.counts?.registered ?? 0} live</div>
        </div>
        {dir.registered?.length ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {dir.registered.map((c) => <Row key={c.name} c={c} />)}
          </div>
        ) : (
          <div className="border border-dashed border-white/12 rounded-lg p-6 text-center">
            <div className="text-[14px] text-white/70">No community capabilities registered yet — be the first.</div>
            <div className="text-[12.5px] text-white/45 mt-1">
              One signature publishes an https endpoint as a capability the whole network (and the brain) can call.
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">
            built-in · fulfilled by the SIGNA gateway from partner sources
          </div>
          <div className="text-[12px] font-mono text-white/45">{dir.counts?.builtin ?? 0}</div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {dir.builtins?.map((c) => <Row key={c.name} c={c} arg={builtinArg(c.name)} />)}
        </div>
      </div>
    </div>
  );
}
