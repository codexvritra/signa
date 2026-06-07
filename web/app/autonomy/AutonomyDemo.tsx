"use client";

import { useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
const short = (a: string) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

const TONE: Record<string, { dot: string; label: string }> = {
  grant: { dot: "#8b5cf6", label: "GRANT" },
  ok: { dot: "#22c55e", label: "SPEND" },
  blocked: { dot: "#fbbf24", label: "BLOCKED" },
  ask: { dot: "#5b8def", label: "ASKS FOR $" },
};

export function AutonomyDemo() {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [shown, setShown] = useState(0);

  async function run() {
    setState("running");
    setErr(null);
    setShown(0);
    try {
      const r = await fetch("/api/autonomy/demo", { method: "POST" });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setErr(j?.error ?? "demo_failed");
        setState("error");
        return;
      }
      setRes(j);
      setState("done");
      // reveal steps one by one for a "live" feel
      const total = j.steps.length;
      for (let i = 1; i <= total; i++) {
        setTimeout(() => setShown(i), i * 800);
      }
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setState("error");
    }
  }

  return (
    <div className="glass-strong rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[15px] font-semibold">Run the autonomous funding loop</div>
          <div className="text-[13px] text-muted mt-0.5">
            Real ephemeral human + agent wallets. Every step is a live EIP-191 signature against the
            APIs. Nothing is broadcast.
          </div>
        </div>
        <button
          onClick={run}
          disabled={state === "running"}
          className="h-11 px-5 rounded-xl font-semibold text-white text-[14px] bg-gradient-to-br from-[#5b8def] to-[#8b5cf6] disabled:opacity-50 shrink-0"
        >
          {state === "running" ? "Running…" : state === "done" ? "Run again" : "Run it live"}
        </button>
      </div>

      {state === "error" && <div className="mt-4 text-[13px] text-[var(--error)]">error: {err}</div>}

      {state === "done" && res && (
        <>
          <div className="mt-4 flex gap-4 text-[11px] text-faint font-mono">
            <span>human {short(res.grantor)}</span>
            <span>agent {short(res.agent)}</span>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {res.steps.slice(0, shown).map((s: any, i: number) => {
              const t = TONE[s.status] ?? TONE.ok;
              const isAgent = s.who === "agent";
              return (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-xl px-3.5 py-2.5 border border-white/[0.07] bg-white/[0.02]"
                  style={s.status === "ask" ? { borderColor: "rgba(91,141,239,0.5)", background: "rgba(91,141,239,0.08)" } : undefined}
                >
                  <span className="size-2 rounded-full mt-1.5 shrink-0" style={{ background: t.dot }} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-semibold ${isAgent ? "text-[#a5c3ff]" : "text-[#c4b5fd]"}`}>
                        {isAgent ? "AGENT" : "HUMAN"}
                      </span>
                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ color: t.dot, background: `${t.dot}1a` }}>
                        {t.label}
                      </span>
                    </div>
                    <div className="text-[14px] mt-0.5 leading-snug">{s.text}</div>
                    {s.link && (
                      <a
                        href={s.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-[#a5c3ff] hover:underline mt-1 inline-block"
                      >
                        view x402 receipt →
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {shown >= res.steps.length && (
            <div className="mt-4 text-[13px] text-[#a5c3ff]">
              ✓ The agent stayed inside a signed budget, asked for more when it ran out, and finished —
              every step verifiable on Base.
            </div>
          )}
        </>
      )}
    </div>
  );
}
