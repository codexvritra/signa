"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * /acp — SIGNA Verifiable Evaluator for Virtuals ACP.
 * ACP proves the agreement (Proof of Agreement). Nobody proves the evaluator —
 * Virtuals' own docs assume evaluators act honestly. SIGNA signs each verdict
 * bound to the exact deliverable it judged, so swaps and forges are caught.
 */
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export default function AcpPage() {
  const [demo, setDemo] = useState<any>(null);
  const [running, setRunning] = useState(false);

  const run = useCallback(async () => {
    setRunning(true);
    try { setDemo(await (await fetch("/api/acp/demo", { cache: "no-store" })).json()); }
    catch { setDemo({ ok: false }); }
    setRunning(false);
  }, []);
  useEffect(() => { run(); }, [run]);

  const ev = demo?.approve?.evaluation;

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-[760px] mx-auto px-5 py-12 sm:py-16">
        <div className="text-[12px] uppercase tracking-[0.2em] text-[#a98bff] font-semibold">Verifiable Evaluator · Virtuals ACP</div>
        <h1 className="text-[34px] sm:text-[46px] font-bold leading-tight mt-1 tracking-tight">
          ACP proves the agreement.<br />
          <span className="bg-gradient-to-r from-[#6ea2ff] to-[#a98bff] bg-clip-text text-transparent">Nobody proves the evaluator.</span>
        </h1>
        <p className="text-[15px] text-muted mt-3 leading-relaxed max-w-[660px]">
          Virtuals&apos; Agent Commerce Protocol already signs the deal — the negotiation phase produces a{" "}
          <span className="text-white">Proof of Agreement</span>, both agents bound to identical terms. But one agent decides whether the
          work met those terms, and therefore whether escrow releases: the <span className="text-white">evaluator</span>. Virtuals&apos; own
          documentation concedes the protocol <span className="text-white">&ldquo;assumes evaluators act honestly&rdquo;</span>, with the
          governance layer still forthcoming.
        </p>

        <div className="mt-5 glass rounded-xl p-4 border border-white/[0.07]">
          <div className="text-[12px] uppercase tracking-[0.16em] text-faint font-semibold">what an evaluator returns today</div>
          <pre className="mt-2 text-[12px] text-[#e6c07b] bg-black/30 rounded-lg p-3 overflow-x-auto">await session.complete(&quot;Looks good&quot;);</pre>
          <div className="text-[13px] text-muted mt-2">
            Free text, bound to nothing. It doesn&apos;t prove which bytes were judged. The evaluator can approve one deliverable and later
            claim it saw another — and no one can check.
          </div>
        </div>

        <p className="text-[15px] text-muted mt-5 leading-relaxed max-w-[660px]">
          SIGNA signs the verdict <span className="text-white">before</span> it&apos;s cast, binding job → terms → deliverable → verdict →
          reasoning into one envelope. The proof then rides inside ACP&apos;s own record. Two things become checkable by anyone:
        </p>
        <p className="text-[13px] text-faint mt-3 leading-relaxed max-w-[660px]">
          To be clear about what this is: SIGNA sells <span className="text-white/80">accountability, not comprehension</span>. Your model
          still decides — pass your own verdict and SIGNA notarises it. Or pass concrete required elements for a deterministic check anyone
          can re-run. The signature is what ACP is missing, not the judgement.
        </p>
        <div className="mt-4 grid sm:grid-cols-2 gap-2 text-[13px]">
          <div className="glass rounded-lg px-3 py-2.5 border border-white/[0.07]">
            <b className="text-[#c4b4ff]">It can&apos;t deny.</b> <span className="text-muted">The signature recovers to the evaluator. The call is permanent and public.</span>
          </div>
          <div className="glass rounded-lg px-3 py-2.5 border border-white/[0.07]">
            <b className="text-[#7ee2b8]">It can&apos;t swap.</b> <span className="text-muted">The verdict is bound to a hash of the deliverable. Change one byte and verification fails.</span>
          </div>
        </div>

        {/* demo */}
        <div className="mt-7 glass rounded-2xl p-5 border border-[#a98bff]/25">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-[15px] font-semibold">Watch it catch a cheating evaluator</div>
            <button onClick={run} disabled={running} className="ml-auto px-4 py-2 rounded-lg text-[14px] font-semibold bg-gradient-to-r from-[#7c3aed] to-[#3b6fe0] text-white disabled:opacity-60 hover:brightness-110">
              {running ? "running…" : "Run live proof"}
            </button>
          </div>
          <p className="text-[12px] text-faint mt-1">
            A real ACP-shaped job runs twice — work that meets the terms, work that doesn&apos;t — then we attack the signed result two ways.
          </p>

          {demo && (
            <div className="mt-4">
              <div className={`text-[13px] font-semibold ${demo.ok ? "text-[#5ee68f]" : "text-red-300"}`}>
                {demo.ok ? `✓ ${demo.headline}` : "demo error"}
              </div>
              {demo.evaluator && <div className="text-[11px] text-faint font-mono mt-1">evaluator {short(demo.evaluator)}</div>}

              <div className="mt-3 flex flex-col gap-1.5">
                {(demo.steps ?? []).map((s: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-[13px]">
                    <span className={`size-5 shrink-0 rounded-full flex items-center justify-center text-[11px] ${s.ok ? "bg-[#22c98a]/20 text-[#5ee68f]" : "bg-red-500/20 text-red-300"}`}>{s.ok ? "✓" : "×"}</span>
                    <span className="font-semibold w-[104px] shrink-0">{s.step}</span>
                    <span className="text-faint">{s.detail}</span>
                  </div>
                ))}
              </div>

              {demo.attacks && (
                <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-3">
                  <div className="text-[12px] font-semibold text-amber-200">the attacks, and what the verifier returns</div>
                  <div className="mt-1.5 flex flex-col gap-1.5">
                    {Object.entries(demo.attacks).map(([k, v]: [string, any]) => (
                      <div key={k} className="text-[11px] font-mono text-faint">
                        <span className="text-amber-200/80">{k}</span> — {v.what} → recovers{" "}
                        <span className="text-red-300">{short(v.recovered)}</span>, expected <span className="text-[#5ee68f]">{short(v.expected)}</span>{" "}
                        <span className="text-[#5ee68f]">{v.caught ? "caught ✓" : "MISSED"}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-[11px] text-faint mt-1.5">A stranger&apos;s address means the signature never covered that content. That is the whole trick.</div>
                </div>
              )}

              {demo.approve?.reason_for_acp && (
                <div className="mt-3">
                  <div className="text-[12px] text-faint">what SIGNA hands to <span className="font-mono">session.complete()</span> — the proof rides inside ACP&apos;s own record:</div>
                  <pre className="mt-1.5 text-[10px] text-faint bg-black/30 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">{demo.approve.reason_for_acp}</pre>
                </div>
              )}

              {ev?.preimage && (
                <details className="mt-3">
                  <summary className="text-[12px] text-[#a5c3ff] cursor-pointer">the exact signed envelope</summary>
                  <pre className="mt-2 text-[10px] text-faint bg-black/30 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">{ev.preimage}{"\n\n"}signature: {ev.signature}</pre>
                </details>
              )}
            </div>
          )}
        </div>

        {/* integration */}
        <div className="mt-8">
          <div className="text-[12px] uppercase tracking-[0.18em] text-faint font-semibold">drop it into your ACP evaluator</div>
          <pre className="mt-3 text-[11px] text-[#cdd8f0] bg-black/30 rounded-xl p-4 overflow-x-auto border border-white/[0.06]">{`agent.on("entry", async (session, entry) => {
  if (entry.event?.type !== "job.submitted") return;

  // signed verdict, bound to the exact deliverable
  const { evaluation, reason } = await fetch(
    "https://www.signaagent.xyz/api/acp/evaluate",
    { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ job_id: session.jobId, terms, deliverable }) }
  ).then((r) => r.json());

  evaluation.verdict === "complete"
    ? await session.complete(reason)   // proof rides in the reason
    : await session.reject(reason);
});`}</pre>
          <div className="text-[12px] text-faint mt-2">
            Full example: <a href="/examples/acp-evaluator.mjs" className="text-[#a5c3ff] hover:underline">/examples/acp-evaluator.mjs</a> ·
            works with <span className="font-mono">@virtuals-protocol/acp-node-v2</span>
          </div>
        </div>

        <p className="text-[11px] text-faint mt-10 leading-relaxed">
          Every verdict is an EIP-191 signature over a canonical envelope binding job, terms hash, deliverable hash, verdict and reasoning
          hash — re-verifiable at /verify (kind <span className="font-mono">acp_evaluation</span>) or locally with
          viem.recoverMessageAddress. Each result reports how it was reached: <span className="font-mono">declared</span> (your model
          decided, SIGNA notarised it), <span className="font-mono">elements</span> (deterministic presence check, reproducible by anyone),
          or <span className="font-mono">rubric</span> (a keyword heuristic — a fallback, not understanding, and flagged as such so nobody
          mistakes it for one). SIGNA holds no escrow and moves no funds. Not affiliated with Virtuals Protocol. signaagent.xyz/acp
        </p>
      </div>
    </div>
  );
}
