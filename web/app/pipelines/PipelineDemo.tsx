"use client";

import { useState } from "react";

type Step = { step: number; cap: string; provider: string; kind: string; output: unknown; error?: string };
type Link = { step: number; cap: string; provider: string; output_hash: string; prev: string; signature: string };
type Run = { ok: boolean; runId: string; steps: Step[]; chain: Link[]; root: string; gateway: string; completed: boolean };
type Verdict = { valid: boolean; root_ok: boolean; links: { step: number; cap: string; sig_ok: boolean; chain_ok: boolean; output_hash_ok: boolean | null }[] };

const DEMO_STEPS = [
  { cap: "root.feargreed", arg: "" },
  { cap: "token.price", arg: "ethereum" },
  { cap: "signa.reason", arg: "Crypto fear and greed is {{0.label}} ({{0.score}}) and ETH is ${{1.price_usd}}. Give a one sentence read on the Base market. No advice." },
];

const short = (s?: string) => (s && s.length > 16 ? `${s.slice(0, 10)}…${s.slice(-6)}` : s ?? "");
function preview(o: unknown): string {
  if (o == null) return "—";
  if (typeof o === "object") {
    const r = o as Record<string, unknown>;
    if (typeof r.response === "string") return r.response.slice(0, 160);
    return JSON.stringify(o).slice(0, 140);
  }
  return String(o).slice(0, 140);
}

export function PipelineDemo() {
  const [run, setRun] = useState<Run | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [busy, setBusy] = useState<"run" | "verify" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function doRun() {
    setBusy("run"); setErr(null); setVerdict(null); setRun(null);
    try {
      const r = await fetch("/api/pipelines/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ steps: DEMO_STEPS }) });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
      setRun(j);
    } catch (e) { setErr(e instanceof Error ? e.message : "run failed"); }
    finally { setBusy(null); }
  }

  async function doVerify() {
    if (!run) return;
    setBusy("verify"); setErr(null);
    try {
      const r = await fetch("/api/pipelines/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ runId: run.runId, chain: run.chain, steps: run.steps, root: run.root }) });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
      setVerdict(j);
    } catch (e) { setErr(e instanceof Error ? e.message : "verify failed"); }
    finally { setBusy(null); }
  }

  const v = (step: number) => verdict?.links.find((l) => l.step === step);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <button onClick={doRun} disabled={busy !== null}
          className="bg-[var(--accent)] text-black font-semibold rounded-full px-5 py-2.5 text-[14px] hover:brightness-110 transition uppercase tracking-wide font-mono disabled:opacity-50">
          {busy === "run" ? "running…" : "run the pipeline"}
        </button>
        {run && (
          <button onClick={doVerify} disabled={busy !== null}
            className="border border-white/15 hover:border-white/30 text-white font-medium rounded-full px-5 py-2.5 text-[14px] transition-colors disabled:opacity-50">
            {busy === "verify" ? "verifying…" : "re-verify the chain"}
          </button>
        )}
        <span className="text-[12px] text-white/40 font-mono">root.feargreed → token.price → signa.reason</span>
      </div>

      {err && <div className="text-[13px] text-red-300/90 mb-3">error: {err}</div>}

      {run && (
        <div className="space-y-3">
          {run.steps.map((s) => {
            const link = run.chain.find((l) => l.step === s.step);
            const vr = v(s.step);
            return (
              <div key={s.step} className="border border-white/10 rounded-lg bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="font-mono text-[14px] text-[var(--accent)]">
                    {s.step}. {s.cap} <span className="text-white/35">· {s.kind} · {short(s.provider)}</span>
                  </div>
                  {vr && (
                    <span className={`text-[11px] font-mono rounded-full px-2 py-0.5 border ${vr.sig_ok && vr.chain_ok && vr.output_hash_ok !== false ? "text-[var(--accent)] border-[var(--accent)]/30" : "text-red-300 border-red-300/30"}`}>
                      {vr.sig_ok && vr.chain_ok && vr.output_hash_ok !== false ? "✓ verified" : "✗ invalid"}
                    </span>
                  )}
                </div>
                <div className="text-[13px] text-white/70 leading-relaxed mt-1.5">{s.error ? <span className="text-red-300/90">error: {s.error}</span> : preview(s.output)}</div>
                {link && <div className="text-[10.5px] text-white/30 font-mono mt-2 break-all">sig {short(link.signature)} · prev {link.prev === "genesis" ? "genesis" : short(link.prev)}</div>}
              </div>
            );
          })}
          <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
            <div className="text-[12px] text-white/45 font-mono break-all">chain root {short(run.root)} · signed by gateway {short(run.gateway)}</div>
            {verdict && (
              <div className={`text-[13px] font-semibold ${verdict.valid ? "text-[var(--accent)]" : "text-red-300"}`}>
                {verdict.valid ? "✓ whole chain re-verified — every link signed + hash-chained, outputs match" : "✗ chain failed verification"}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
