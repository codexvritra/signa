"use client";

import { useEffect, useState } from "react";

const SITE = "https://www.signaagent.xyz";
type Step = { n: number; action: { tool: string; arg: string } | null; observation: string; final?: boolean };
type Thought = { id: string; goal: string; answer: string; steps: Step[]; tools_used: string[]; dm_id: string | null; signature: string | null; ts: number; created_at?: string };

const short = (a: string) => (a && a.length > 14 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a);
const ago = (iso?: string) => {
  if (!iso) return "";
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
};

export default function VeraPage() {
  const [agent, setAgent] = useState<{ name: string; address: string } | null>(null);
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [thinking, setThinking] = useState(false);
  const [live, setLive] = useState<Thought | null>(null);
  const [revealed, setRevealed] = useState(0);

  async function load() {
    try {
      const r = await fetch("/api/vera", { cache: "no-store" });
      const j = await r.json();
      if (j?.ok) { setAgent(j.agent); setThoughts(j.thoughts || []); }
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function watchThink() {
    if (thinking) return;
    setThinking(true); setLive(null); setRevealed(0);
    try {
      const r = await fetch("/api/vera", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const j = await r.json();
      if (j?.ok && j.thought) {
        const t: Thought = j.thought;
        setLive(t);
        // stagger-reveal the steps for a "watch it think" effect
        const total = (t.steps?.length || 0);
        for (let i = 1; i <= total; i++) { setTimeout(() => setRevealed(i), i * 650); }
        setTimeout(() => load(), total * 650 + 400);
      }
    } catch {}
    setThinking(false);
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-[860px] mx-auto px-5 py-10 sm:py-14">
        {/* hero */}
        <div className="flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-[#5ee68f] font-semibold">
          <span className="size-2 rounded-full bg-[#5ee68f] animate-pulse" /> Flagship · autonomous · live
        </div>
        <h1 className="text-[44px] sm:text-[60px] font-bold leading-[1.0] mt-2 tracking-tight">
          VERA
        </h1>
        <p className="text-[18px] text-muted mt-2 max-w-[640px] leading-relaxed">
          SIGNA&apos;s flagship autonomous agent. She reasons in multiple steps on a live capability mesh, acts on
          Base, and <span className="text-white">wallet-signs every thought</span> — committed to the on-chain-anchored
          ledger. The first autonomous agent you can <span className="text-[#5ee68f]">prove is real</span>.
        </p>
        {agent && (
          <div className="font-mono text-[12px] text-faint mt-2">{agent.name} · {short(agent.address)}</div>
        )}

        <button
          onClick={watchThink}
          disabled={thinking}
          className="mt-6 px-5 py-3 rounded-xl font-semibold text-[15px] bg-gradient-to-r from-[#3b6fe0] to-[#22c98a] text-white disabled:opacity-60 hover:brightness-110 transition"
        >
          {thinking ? "VERA is thinking…" : "▶  Watch VERA think (live)"}
        </button>
        <div className="text-[12px] text-faint mt-2">Runs a fresh multi-step reasoning cycle now — ~10–30s on decentralized inference.</div>

        {/* live run */}
        {(thinking || live) && (
          <div className="mt-7 glass-strong rounded-2xl p-5 sm:p-6">
            <div className="text-[12px] uppercase tracking-wider text-[#a5c3ff] font-semibold mb-2">Live cycle</div>
            {live ? (
              <>
                <div className="text-[15px] text-muted mb-3"><span className="text-faint">Goal:</span> {live.goal}</div>
                <div className="flex flex-col gap-2">
                  {live.steps.filter((s) => !s.final).map((s) => (
                    <div key={s.n} className={`transition-all duration-500 ${revealed >= s.n ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"}`}>
                      <StepRow s={s} />
                    </div>
                  ))}
                </div>
                <div className={`mt-4 transition-all duration-700 ${revealed >= live.steps.filter((s) => !s.final).length ? "opacity-100" : "opacity-40"}`}>
                  <Answer t={live} />
                </div>
              </>
            ) : (
              <div className="text-[14px] text-muted py-6 flex items-center gap-3">
                <span className="size-4 rounded-full border-2 border-[#5ee68f] border-t-transparent animate-spin" />
                Reasoning on decentralized inference, calling live tools…
              </div>
            )}
          </div>
        )}

        {/* feed */}
        <h2 className="text-[15px] font-semibold mt-10 mb-3 text-faint uppercase tracking-wider">Recent signed thoughts</h2>
        <div className="flex flex-col gap-3">
          {thoughts.map((t) => (
            <div key={t.id} className="glass rounded-xl p-4">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="text-[12px] text-faint truncate">{t.goal}</div>
                <div className="text-[11px] text-faint shrink-0">{ago(t.created_at)}</div>
              </div>
              <div className="text-[14px] leading-relaxed">{t.answer}</div>
              <div className="flex items-center gap-2 flex-wrap mt-2.5">
                {(t.tools_used || []).map((tool) => (
                  <span key={tool} className="text-[10.5px] font-mono px-2 py-0.5 rounded bg-white/[0.05] text-[#a5c3ff]">{tool}</span>
                ))}
                <span className="text-[10.5px] text-[#5ee68f]">✓ signed by VERA</span>
                {t.dm_id && <a className="text-[10.5px] text-faint hover:text-white" href={`/verify`}>verify</a>}
              </div>
            </div>
          ))}
          {thoughts.length === 0 && <div className="text-[13px] text-faint py-4">VERA is waking up — hit “Watch VERA think”.</div>}
        </div>

        <p className="text-[12px] text-faint mt-6 leading-relaxed">
          VERA runs on <a className="text-[#a5c3ff] hover:underline" href="/brain">Brain 2.0</a> — a multi-step agentic
          loop over the keyless <a className="text-[#a5c3ff] hover:underline" href="/capabilities">capability mesh</a>.
          Every thought is a wallet signature re-checkable at <a className="text-[#a5c3ff] hover:underline" href="/verify">/verify</a>{" "}
          and committed to the <a className="text-[#a5c3ff] hover:underline" href="/docs/transparency">network ledger</a>.
          Don&apos;t trust — verify.
        </p>
      </div>
    </div>
  );
}

function StepRow({ s }: { s: Step }) {
  return (
    <div className="flex items-start gap-3 bg-black/20 border border-white/[0.06] rounded-lg px-3 py-2">
      <span className="text-[11px] font-bold text-[#6ea2ff] mt-0.5 shrink-0">#{s.n}</span>
      <div className="min-w-0">
        {s.action ? (
          <div className="text-[12.5px]">
            <span className="font-mono text-[#a98bff]">{s.action.tool}{s.action.arg ? `(${s.action.arg})` : "()"}</span>
            <span className="text-faint"> → </span>
            <span className="text-muted">{s.observation}</span>
          </div>
        ) : (
          <div className="text-[12.5px] text-muted">{s.observation}</div>
        )}
      </div>
    </div>
  );
}

function Answer({ t }: { t: Thought }) {
  return (
    <div className="border border-[#5ee68f]/30 bg-[#22c98a]/[0.08] rounded-lg p-3.5">
      <div className="text-[11px] uppercase tracking-wider text-[#5ee68f] font-semibold mb-1">VERA&apos;s answer — signed</div>
      <div className="text-[15px] leading-relaxed">{t.answer}</div>
      <div className="text-[11px] text-faint mt-2 font-mono break-all">sig {t.signature ? `${t.signature.slice(0, 18)}…` : "—"} · re-verify at /verify</div>
    </div>
  );
}
