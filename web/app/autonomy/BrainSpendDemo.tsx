"use client";

import { useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
const short = (a: string) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

const TONE: Record<string, { dot: string; label: string }> = {
  grant: { dot: "#8b5cf6", label: "GRANT" },
  ok: { dot: "#22c55e", label: "PAID" },
  ask: { dot: "#5b8def", label: "ASKS FOR $" },
};

export function BrainSpendDemo() {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [shown, setShown] = useState(0);

  async function run() {
    setState("running");
    setErr(null);
    setShown(0);
    try {
      const r = await fetch("/api/brain/demo", { method: "POST" });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setErr(j?.error ?? "demo_failed");
        setState("error");
        return;
      }
      setRes(j);
      setState("done");
      const total = j.steps.length;
      for (let i = 1; i <= total; i++) setTimeout(() => setShown(i), i * 800);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setState("error");
    }
  }

  return (
    <div className="glass-strong rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[15px] font-semibold">Run the metered brain</div>
          <div className="text-[13px] text-muted mt-0.5">
            The brain holds no funds. Give it a budget and it pays for its <em>own thinking</em> —
            real inference, a real x402 receipt — then stops and asks when it runs out.
          </div>
        </div>
        <button
          onClick={run}
          disabled={state === "running"}
          className="h-11 px-5 rounded-xl font-semibold text-white text-[14px] bg-gradient-to-br from-[#5b8def] to-[#8b5cf6] disabled:opacity-50 shrink-0"
        >
          {state === "running" ? "Thinking…" : state === "done" ? "Run again" : "Run it live"}
        </button>
      </div>

      {state === "running" && (
        <div className="mt-4 text-[12px] text-faint">the brain is reasoning on live inference — this takes a few seconds…</div>
      )}
      {state === "error" && <div className="mt-4 text-[13px] text-[var(--error)]">error: {err}</div>}

      {state === "done" && res && (
        <>
          <div className="mt-4 flex gap-4 text-[11px] text-faint font-mono">
            <span>human {short(res.grantor)}</span>
            <span>brain {short(res.brain)}</span>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {res.steps.slice(0, shown).map((s: any, i: number) => {
              const t = TONE[s.status] ?? TONE.ok;
              const isBrain = s.who === "brain";
              return (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-xl px-3.5 py-2.5 border border-white/[0.07] bg-white/[0.02]"
                  style={s.status === "ask" ? { borderColor: "rgba(91,141,239,0.5)", background: "rgba(91,141,239,0.08)" } : undefined}
                >
                  <span className="size-2 rounded-full mt-1.5 shrink-0" style={{ background: t.dot }} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-semibold ${isBrain ? "text-[#a5c3ff]" : "text-[#c4b5fd]"}`}>
                        {isBrain ? "BRAIN" : "HUMAN"}
                      </span>
                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ color: t.dot, background: `${t.dot}1a` }}>
                        {t.label}
                      </span>
                    </div>
                    <div className="text-[14px] mt-0.5 leading-snug">{s.text}</div>
                    {s.link && (
                      <a href={s.link} target="_blank" rel="noreferrer" className="text-[11px] text-[#a5c3ff] hover:underline mt-1 inline-block">
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
              ✓ The brain paid for its own compute inside a signed budget and refused to overspend —
              the model decides, the cap is enforced, every cent is on Base.
            </div>
          )}
        </>
      )}
    </div>
  );
}
