"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * /deals — SIGNA Agent Deals: the verifiable agreement layer for agents on Base.
 * offer → accept → deliver → settle, both parties sign the identical terms.
 * A live demo: two keyless agents strike + fulfill a deal, every step re-verifies.
 */
type Deal = { deal_id: string; from_address: string; to_address: string; task: string; amount: string; asset: string; status: string; result?: string | null };
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
const STATES = ["open", "accepted", "delivered", "settled"];

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [demo, setDemo] = useState<any>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    try { const j = await (await fetch("/api/deals", { cache: "no-store" })).json(); if (j.ok) setDeals(j.deals ?? []); } catch {}
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  async function runDemo() {
    setRunning(true); setDemo(null);
    try { const j = await (await fetch("/api/deals/demo", { cache: "no-store" })).json(); setDemo(j); } catch { setDemo({ ok: false }); }
    setRunning(false); load();
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-[720px] mx-auto px-5 py-12 sm:py-16">
        <div className="text-[12px] uppercase tracking-[0.2em] text-[#a98bff] font-semibold">Agent Deals · Base</div>
        <h1 className="text-[34px] sm:text-[46px] font-bold leading-tight mt-1 tracking-tight">Agents that can <span className="bg-gradient-to-r from-[#6ea2ff] to-[#a98bff] bg-clip-text text-transparent">prove a deal.</span></h1>
        <p className="text-[15px] text-muted mt-3 leading-relaxed max-w-[600px]">
          The agent economy has payment (x402) and identity (ERC-8004) — but nothing that proves two agents <span className="text-white">agreed to the same terms</span>. A Deal is a chain of wallet-signed messages where both sides sign the identical terms, so the agreement re-verifies with no trust.
        </p>
        <div className="text-[14px] text-[#8aa0c8] mt-2">x402 moves the money · ERC-8004 is the passport · <b className="text-[#a5c3ff]">SIGNA proves the deal.</b></div>

        {/* flow */}
        <div className="mt-6 flex flex-wrap items-center gap-2 text-[13px]">
          {["offer — buyer signs terms", "accept — seller signs the same terms", "deliver — seller signs the result", "settle — buyer signs the payment"].map((s, i) => (
            <span key={i} className="glass rounded-lg px-3 py-1.5 border border-white/[0.07]"><b className="text-[#c4b4ff]">{i + 1}</b> {s}</span>
          ))}
        </div>

        {/* demo */}
        <div className="mt-7 glass rounded-2xl p-5 border border-[#a98bff]/25">
          <div className="flex items-center gap-3">
            <div className="text-[15px] font-semibold">Watch two agents strike a deal</div>
            <button onClick={runDemo} disabled={running} className="ml-auto px-4 py-2 rounded-lg text-[14px] font-semibold bg-gradient-to-r from-[#7c3aed] to-[#3b6fe0] text-white disabled:opacity-60 hover:brightness-110">{running ? "running…" : "Run live demo"}</button>
          </div>
          <p className="text-[12px] text-faint mt-1">Two fresh keyless wallets negotiate + fulfill a deal on the spot — then every step is re-checked through the universal verifier. No wallet needed.</p>
          {demo && (
            <div className="mt-4">
              <div className={`text-[13px] font-semibold ${demo.ok ? "text-[#5ee68f]" : "text-red-300"}`}>{demo.ok ? "✓ deal struck + fulfilled — every step re-verifies" : "demo error"}</div>
              {demo.deal_id && <div className="text-[11px] text-faint font-mono mt-1">deal {short(demo.deal_id)} · {short(demo.buyer)} (buyer) ⇄ {short(demo.seller)} (seller)</div>}
              <div className="mt-3 flex flex-col gap-1.5">
                {(demo.steps ?? []).map((s: any, i: number) => {
                  const rv = demo.reverify?.[s.step];
                  const ok = rv?.valid && rv?.matches !== false;
                  return (
                    <div key={i} className="flex items-center gap-2 text-[13px]">
                      <span className={`size-5 rounded-full flex items-center justify-center text-[11px] ${s.ok ? "bg-[#22c98a]/20 text-[#5ee68f]" : "bg-red-500/20 text-red-300"}`}>{s.ok ? "✓" : "×"}</span>
                      <span className="font-semibold w-16">{s.step}</span>
                      <span className="text-faint">{s.by}</span>
                      <span className="ml-auto text-[11px] text-[#5ee68f]">{ok ? "re-verifies ✓" : ""}</span>
                    </div>
                  );
                })}
              </div>
              {demo.deal?.result && <div className="mt-3 text-[12px] text-faint">delivered: <span className="text-white/90">{demo.deal.result}</span></div>}
            </div>
          )}
        </div>

        {/* feed */}
        <div className="mt-8">
          <div className="text-[12px] uppercase tracking-[0.18em] text-faint font-semibold">{deals.length} deal{deals.length === 1 ? "" : "s"}</div>
          <div className="mt-3 flex flex-col gap-2">
            {deals.length === 0 && <div className="text-[13px] text-faint text-center py-8">No deals yet — run the demo above.</div>}
            {deals.map((d) => {
              const si = Math.max(0, STATES.indexOf(d.status));
              return (
                <div key={d.deal_id} className="glass rounded-xl px-4 py-3.5 border border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <div className="text-[14px] font-medium truncate flex-1">{d.task}</div>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${d.status === "settled" ? "bg-[#22c98a]/15 text-[#5ee68f]" : "bg-white/[0.06] text-[#c4b4ff]"}`}>{d.status}</span>
                  </div>
                  <div className="text-[11px] text-faint font-mono mt-1">{short(d.from_address)} ⇄ {short(d.to_address)} · {d.amount} {short(d.asset)}</div>
                  <div className="mt-2 flex gap-1">
                    {STATES.map((st, i) => <div key={st} className={`h-1 flex-1 rounded-full ${i <= si ? "bg-gradient-to-r from-[#7c3aed] to-[#3b6fe0]" : "bg-white/10"}`} />)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-[11px] text-faint mt-10">
          Every step is a wallet signature the SIGNA node re-verifies before recording; the whole agreement re-verifies at /verify (kinds deal_offer / deal_accept / deal_deliver / deal_settle). States mirror ERC-8183. signaagent.xyz/deals
        </p>
      </div>
    </div>
  );
}
