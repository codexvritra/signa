"use client";

import { useEffect, useState, useCallback } from "react";

type Status = { ok: boolean; reads_live?: boolean; create_live?: boolean; factory?: string; network?: string; checked_at?: number; detail?: string };

export default function B20LivePage() {
  const [s, setS] = useState<Status | null>(null);
  const [spin, setSpin] = useState(false);

  const probe = useCallback(async () => {
    setSpin(true);
    try { setS(await (await fetch("/api/b20/status", { cache: "no-store" })).json()); } catch {}
    setSpin(false);
  }, []);

  useEffect(() => { probe(); const t = setInterval(probe, 30000); return () => clearInterval(t); }, [probe]);

  const live = s?.create_live === true;
  const checked = s?.checked_at ? new Date(s.checked_at).toLocaleTimeString() : "—";

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-[760px] mx-auto px-5 py-12 sm:py-16 text-center">
        <div className="text-[12px] uppercase tracking-[0.2em] text-[#5ee68f] font-semibold">Base · B20 — native token standard</div>
        <h1 className="text-[40px] sm:text-[56px] font-bold leading-[1.02] mt-2 tracking-tight">Is B20 live yet?</h1>

        <div className={`mt-8 mx-auto max-w-[520px] rounded-3xl p-8 border ${live ? "border-[#5ee68f]/40 bg-[#22c98a]/[0.08]" : "border-white/10 bg-white/[0.03]"}`}>
          <div className={`text-[64px] sm:text-[80px] font-black leading-none ${live ? "text-[#5ee68f]" : "text-[#9fb0d0]"}`}>
            {s == null ? "…" : live ? "YES" : "NOT YET"}
          </div>
          <div className="text-[14px] text-muted mt-3">{s?.detail ?? "probing Base mainnet…"}</div>
        </div>

        {/* the two real signals */}
        <div className="grid grid-cols-2 gap-3 mt-6 max-w-[520px] mx-auto">
          <div className="glass rounded-xl p-4">
            <div className="text-[12px] text-faint">address reads</div>
            <div className={`text-[18px] font-bold mt-1 ${s?.reads_live ? "text-[#5ee68f]" : "text-[#ff8f8f]"}`}>{s?.reads_live ? "live ✓" : s ? "down" : "…"}</div>
            <div className="text-[10px] text-faint mt-1 font-mono">getB20Address</div>
          </div>
          <div className="glass rounded-xl p-4">
            <div className="text-[12px] text-faint">token creation</div>
            <div className={`text-[18px] font-bold mt-1 ${live ? "text-[#5ee68f]" : "text-[#f5b042]"}`}>{s == null ? "…" : live ? "live ✓" : "gated"}</div>
            <div className="text-[10px] text-faint mt-1 font-mono">createB20</div>
          </div>
        </div>

        <div className="text-[11px] text-faint mt-4">
          live eth_call probe of the B20 factory <span className="font-mono">0xB20f…0000</span> on Base · last checked {checked} · auto-refreshes
          <button onClick={probe} className="ml-2 underline hover:text-white">{spin ? "checking…" : "check now"}</button>
        </div>

        {/* CTA — armed either way */}
        <div className="mt-9">
          {live ? (
            <>
              <div className="text-[17px] font-semibold text-[#5ee68f]">B20 is LIVE. Launch one — verifiable, in one click.</div>
              <div className="flex gap-2 justify-center mt-3">
                <a href="/b20" className="px-5 py-2.5 rounded-xl font-semibold text-[15px] bg-gradient-to-r from-[#3b6fe0] to-[#8b5cf6] text-white hover:brightness-110">Launch a B20 →</a>
                <a href="/spawn" className="px-5 py-2.5 rounded-xl text-[15px] bg-white/[0.06] text-[#a5c3ff] hover:bg-white/[0.12]">Spawn an agent with a token</a>
              </div>
            </>
          ) : (
            <>
              <div className="text-[15px] text-muted max-w-[560px] mx-auto leading-relaxed">
                Token creation isn&apos;t activated on Base yet — so <span className="text-white">nobody</span> has launched a B20 token. SIGNA is <span className="text-white">armed</span>: the moment <span className="font-mono">createB20</span> flips live, you&apos;ll see it here first and can launch a verifiable B20 — or spawn an agent that launches its own — in one click.
              </div>
              <div className="flex gap-2 justify-center mt-4">
                <a href="/b20" className="px-5 py-2.5 rounded-xl text-[15px] bg-white/[0.06] text-[#a5c3ff] hover:bg-white/[0.12]">See the B20 tools (ready now)</a>
                <a href="/spawn" className="px-5 py-2.5 rounded-xl text-[15px] bg-white/[0.06] text-[#a5c3ff] hover:bg-white/[0.12]">Spawn an agent</a>
              </div>
            </>
          )}
        </div>

        <p className="text-[11px] text-faint mt-10">
          SIGNA is the verifiable launch + receipt layer for B20. The signed layer (receipts, money-notes, reserves, agents) works today; the on-chain mint unlocks here when Base activates it.
          <br />signaagent.xyz/b20live
        </p>
      </div>
    </div>
  );
}
