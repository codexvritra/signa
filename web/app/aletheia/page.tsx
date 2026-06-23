"use client";

import { useState } from "react";

type Step = { n: number; action: { tool: string; arg: string } | null; observation: string; final?: boolean };
type Result = {
  ok: boolean; model: string; goal: string; answer: string; steps: Step[]; tools_used: string[];
  receipt?: { model: string; version: string; ts: number; signature: string; answer_hash: string };
  reverify?: Record<string, unknown>; signer?: string;
};

const SAMPLES = [
  "Read the Base market and give me a sharp one-line take with a number.",
  "Is now a cheap moment to transact on Base? Check gas and the latest block.",
  "What's the fear & greed index right now and the contrarian move it implies?",
];
const cleanObs = (o: string) => { try { const j = JSON.parse(o); return Object.entries(j).slice(0, 3).map(([k, v]) => `${k}: ${String(v).slice(0, 22)}`).join(" · "); } catch { return o.slice(0, 90); } };

export default function AletheiaPage() {
  const [goal, setGoal] = useState(SAMPLES[0]);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [verify, setVerify] = useState<{ valid: boolean; recovered: string } | null>(null);

  async function reason() {
    if (busy || goal.trim().length < 3) return;
    setBusy(true); setRes(null); setVerify(null);
    try {
      const r = await fetch("/api/brain2", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ goal: goal.trim() }) });
      const j = await r.json();
      if (j?.ok) setRes(j);
    } catch {}
    setBusy(false);
  }
  async function doVerify() {
    if (!res?.reverify) return;
    try {
      const r = await fetch("/api/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(res.reverify) });
      const j = await r.json();
      setVerify({ valid: !!j.valid, recovered: j.recovered });
    } catch {}
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-[880px] mx-auto px-5 py-10 sm:py-14">
        {/* hero */}
        <div className="text-[12px] uppercase tracking-[0.2em] text-[#5ee68f] font-semibold">SIGNA · model release</div>
        <h1 className="text-[52px] sm:text-[72px] font-bold leading-[0.98] mt-2 tracking-tight">
          <span className="bg-gradient-to-r from-[#6ea2ff] to-[#a98bff] bg-clip-text text-transparent">ALETHEIA</span>
        </h1>
        <div className="text-[16px] text-muted mt-1">Aletheia 1.0 — SIGNA&apos;s verifiable reasoning model</div>
        <p className="text-[20px] mt-4 max-w-[680px] leading-relaxed">
          Greek for <span className="italic">truth made visible</span>. The first reasoning model where every answer is
          <span className="text-[#6ea2ff]"> grounded in live data</span>,
          <span className="text-[#5ee68f]"> wallet-signed by the model</span>, and
          <span className="text-[#a98bff]"> re-verifiable by anyone</span>. Not bigger — provable.
        </p>

        {/* playground */}
        <div className="mt-8 glass-strong rounded-2xl p-5 sm:p-6">
          <div className="text-[12px] uppercase tracking-wider text-[#a5c3ff] font-semibold mb-2">Live playground</div>
          <textarea
            value={goal} onChange={(e) => setGoal(e.target.value)} rows={2}
            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-[15px] outline-none focus:border-[#6ea2ff]/60 resize-none"
          />
          <div className="flex items-center gap-2 flex-wrap mt-2">
            {SAMPLES.map((s) => (
              <button key={s} onClick={() => setGoal(s)} className="text-[11px] px-2 py-1 rounded bg-white/[0.05] text-faint hover:text-white">{s.slice(0, 38)}…</button>
            ))}
          </div>
          <button onClick={reason} disabled={busy} className="mt-4 px-5 py-2.5 rounded-xl font-semibold text-[15px] bg-gradient-to-r from-[#3b6fe0] to-[#8b5cf6] text-white disabled:opacity-60 hover:brightness-110 transition">
            {busy ? "Aletheia is reasoning…" : "Reason →"}
          </button>

          {busy && (
            <div className="mt-5 text-[14px] text-muted flex items-center gap-3">
              <span className="size-4 rounded-full border-2 border-[#a98bff] border-t-transparent animate-spin" /> thinking in steps, calling live tools…
            </div>
          )}

          {res && (
            <div className="mt-5">
              <div className="text-[12px] text-faint mb-2">Reasoning trace · {res.tools_used.length} live tool{res.tools_used.length === 1 ? "" : "s"}</div>
              <div className="flex flex-col gap-2">
                {res.steps.filter((s) => s.action).map((s) => (
                  <div key={s.n} className="flex items-start gap-3 bg-black/20 border border-white/[0.06] rounded-lg px-3 py-2">
                    <span className="text-[11px] font-bold text-[#6ea2ff] mt-0.5">#{s.n}</span>
                    <div className="text-[12.5px]">
                      <span className="font-mono text-[#a98bff]">{s.action!.tool}{s.action!.arg ? `(${s.action!.arg})` : "()"}</span>
                      <span className="text-faint"> → </span><span className="text-muted font-mono">{cleanObs(s.observation)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 border border-[#5ee68f]/30 bg-[#22c98a]/[0.08] rounded-lg p-4">
                <div className="text-[11px] uppercase tracking-wider text-[#5ee68f] font-semibold mb-1">Answer — signed by Aletheia</div>
                <div className="text-[16px] leading-relaxed">{res.answer}</div>
                <div className="text-[11px] text-faint mt-2.5 font-mono break-all">
                  {res.model} · sig {res.receipt?.signature.slice(0, 20)}…
                </div>
                <div className="mt-2.5 flex items-center gap-3">
                  <button onClick={doVerify} className="text-[12px] px-3 py-1 rounded bg-white/[0.06] text-[#a5c3ff] hover:bg-white/[0.12]">Verify this answer</button>
                  {verify && (
                    <span className={`text-[12px] ${verify.valid ? "text-[#5ee68f]" : "text-[#ff8f8f]"}`}>
                      {verify.valid ? `✓ valid — recovers to ${verify.recovered.slice(0, 8)}… (the model)` : "✗ invalid"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* model card */}
        <h2 className="text-[18px] font-bold mt-12 mb-3">Model card</h2>
        <p className="text-[14px] text-muted leading-relaxed">
          Aletheia is a <span className="text-white">verifiable reasoning model</span>: it reasons on SIGNA&apos;s
          decentralized inference and acts through the keyless capability mesh (live market, prices, gas, launches,
          TVL), then commits to its answer with a wallet signature. Its edge isn&apos;t parameter count — it&apos;s
          that <span className="text-white">you never have to trust the output</span>. Every answer ships with a
          signature anyone can recover, and the numbers it cites come from real tool calls, not memory.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
          {[
            ["Signed", "Every answer is wallet-signed by the model key. Recover the signer at /api/verify.", "#5ee68f"],
            ["Grounded", "Cites live tool data, not training memory — no hallucinated numbers.", "#6ea2ff"],
            ["Anchored", "Answers land in SIGNA's on-chain-anchored ledger on Base — tamper-evident.", "#a98bff"],
          ].map(([h, d, c]) => (
            <div key={h} className="glass rounded-xl p-4">
              <div className="text-[15px] font-bold" style={{ color: c }}>{h}</div>
              <div className="text-[12.5px] text-muted mt-1.5 leading-relaxed">{d}</div>
              <div className="text-[11px] text-faint mt-2">vs a typical LLM: <span className="text-[#ff8f8f]">✗</span></div>
            </div>
          ))}
        </div>

        <p className="text-[12px] text-faint mt-8 leading-relaxed">
          Aletheia powers <a className="text-[#a5c3ff] hover:underline" href="/vera">VERA</a> (the autonomous agent) and the
          SIGNA <a className="text-[#a5c3ff] hover:underline" href="/brain">brain</a>. API: <span className="font-mono">POST /api/brain2 {`{ goal }`}</span>.
          Re-verify any answer at <a className="text-[#a5c3ff] hover:underline" href="/verify">/verify</a> (kind <span className="font-mono">aletheia</span>). Don&apos;t trust — verify.
        </p>
      </div>
    </div>
  );
}
