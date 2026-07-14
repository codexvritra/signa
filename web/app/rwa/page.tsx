"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * /rwa — SIGNA Proof-of-Stock: the verifiable registry for Robinhood Chain
 * Stock Tokens. Robinhood tokenized the equities; the chain is permissionless,
 * so every real ticker has impostors. SIGNA signs which contract is canonical
 * and what its onchain supply was at a block — re-checkable two ways.
 */
type Market = { price_usd: number | null; market_cap: number | null; holders: number | null };
type Attestation = {
  ts: number; chain: number; chain_name: string; block: string; ticker: string; subject: string; company: string;
  asset_class: "stock" | "etf"; contract: string; decimals: number; supply: string; supply_display: string;
  explorer: string; signer: string; signature: string; preimage: string; market: Market;
};

const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
const usd = (n: number | null) => (n == null ? "—" : n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(2)}`);
const px = (n: number | null) => (n == null ? "—" : `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
const amt = (s: string) => {
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

export default function RwaPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [checked, setChecked] = useState<Record<string, "ok" | "bad" | "checking">>({});

  const load = useCallback(async () => {
    try {
      const j = await (await fetch("/api/rwa", { cache: "no-store" })).json();
      setData(j);
    } catch { setData({ ok: false }); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function runDemo() {
    setRunning(true); setDemo(null);
    try { setDemo(await (await fetch("/api/rwa/demo", { cache: "no-store" })).json()); }
    catch { setDemo({ ok: false }); }
    setRunning(false);
  }

  /** Re-verify one attestation through the universal verifier — no trust in this page. */
  async function verifyOne(a: Attestation) {
    setChecked((c) => ({ ...c, [a.ticker]: "checking" }));
    try {
      const r = await fetch("/api/verify", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...a, kind: "rwa_attestation" }),
      });
      const j = await r.json();
      setChecked((c) => ({ ...c, [a.ticker]: j.valid && j.matches ? "ok" : "bad" }));
    } catch { setChecked((c) => ({ ...c, [a.ticker]: "bad" })); }
  }

  const tokens: Attestation[] = data?.tokens ?? [];

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-[980px] mx-auto px-5 py-12 sm:py-16">
        <div className="text-[12px] uppercase tracking-[0.2em] text-[#a98bff] font-semibold">Proof-of-Stock · Robinhood Chain</div>
        <h1 className="text-[34px] sm:text-[46px] font-bold leading-tight mt-1 tracking-tight">
          Robinhood tokenizes the stock.<br />
          <span className="bg-gradient-to-r from-[#6ea2ff] to-[#a98bff] bg-clip-text text-transparent">SIGNA proves it&apos;s real.</span>
        </h1>
        <p className="text-[15px] text-muted mt-3 leading-relaxed max-w-[660px]">
          Robinhood Chain went live with tokenized equities — NVDA, TSLA, SpaceX, Circle. But the chain is permissionless: for every
          genuine Stock Token, <span className="text-white">anyone can deploy an impostor with the same ticker</span>. Search NVDA on the
          explorer and the real one sits beside five fakes.
        </p>
        <p className="text-[15px] text-muted mt-2 leading-relaxed max-w-[660px]">
          SIGNA settles it with a signature, not a promise. For each ticker the SIGNA attestor wallet signs a canonical envelope:
          <span className="text-white"> this contract is the real one, and at block N its supply was S</span>. Anyone re-checks it two
          independent ways — recover the signature, and replay the read onchain.
        </p>

        {/* the two legs */}
        <div className="mt-6 grid sm:grid-cols-2 gap-2 text-[13px]">
          <div className="glass rounded-lg px-3 py-2.5 border border-white/[0.07]">
            <b className="text-[#c4b4ff]">Leg 1 — the vouch.</b> <span className="text-muted">The signature recovers to SIGNA&apos;s RWA attestor. That&apos;s SIGNA staking its key on which contract is canonical.</span>
          </div>
          <div className="glass rounded-lg px-3 py-2.5 border border-white/[0.07]">
            <b className="text-[#7ee2b8]">Leg 2 — the state.</b> <span className="text-muted">Replay the eth_call at that block yourself. The supply matches, or the attestation is worthless.</span>
          </div>
        </div>

        {/* demo */}
        <div className="mt-7 glass rounded-2xl p-5 border border-[#a98bff]/25">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-[15px] font-semibold">Prove it on a real Stock Token</div>
            <button onClick={runDemo} disabled={running} className="ml-auto px-4 py-2 rounded-lg text-[14px] font-semibold bg-gradient-to-r from-[#7c3aed] to-[#3b6fe0] text-white disabled:opacity-60 hover:brightness-110">
              {running ? "reading chain…" : "Run live proof"}
            </button>
          </div>
          <p className="text-[12px] text-faint mt-1">
            Reads the real NVIDIA Stock Token on Robinhood Chain, signs its state, re-verifies the signature, replays the read onchain, and lists the ticker squatters it&apos;s protecting against. Nothing mocked.
          </p>
          {demo && (
            <div className="mt-4">
              <div className={`text-[13px] font-semibold ${demo.ok ? "text-[#5ee68f]" : "text-red-300"}`}>
                {demo.ok ? `✓ ${demo.headline}` : "proof failed — see below"}
              </div>
              {demo.canonical_contract && (
                <div className="text-[11px] text-faint font-mono mt-1">{demo.subject} · canonical {short(demo.canonical_contract)} · attestor {short(demo.attestor)}</div>
              )}
              <div className="mt-3 flex flex-col gap-1.5">
                {(demo.steps ?? []).map((s: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-[13px]">
                    <span className={`size-5 shrink-0 rounded-full flex items-center justify-center text-[11px] ${s.ok ? "bg-[#22c98a]/20 text-[#5ee68f]" : "bg-red-500/20 text-red-300"}`}>{s.ok ? "✓" : "×"}</span>
                    <span className="font-semibold w-[122px] shrink-0">{s.step}</span>
                    <span className="text-faint">{s.detail}</span>
                  </div>
                ))}
              </div>
              {demo.impostors?.count > 0 && (
                <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-3">
                  <div className="text-[12px] font-semibold text-amber-200">{demo.impostors.count} impostor contract{demo.impostors.count === 1 ? "" : "s"} squatting this ticker</div>
                  <div className="mt-1.5 flex flex-col gap-1">
                    {demo.impostors.items.map((im: any) => (
                      <div key={im.address} className="text-[11px] font-mono text-faint flex gap-2">
                        <span className="text-amber-200/70">{im.symbol}</span>
                        <span className="truncate">{im.name || "(no name)"}</span>
                        <span className="ml-auto">{short(im.address)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-[11px] text-faint mt-1.5">SIGNA&apos;s signature is what tells a wallet, an agent, or an index which of these is the real one.</div>
                </div>
              )}
              {demo.attestation?.preimage && (
                <details className="mt-3">
                  <summary className="text-[12px] text-[#a5c3ff] cursor-pointer">the exact signed message</summary>
                  <pre className="mt-2 text-[10px] text-faint bg-black/30 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">{demo.attestation.preimage}{"\n\n"}signature: {demo.attestation.signature}</pre>
                </details>
              )}
            </div>
          )}
        </div>

        {/* registry */}
        <div className="mt-9">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="text-[12px] uppercase tracking-[0.18em] text-faint font-semibold">
              {loading ? "attesting…" : `${tokens.length} canonical stock token${tokens.length === 1 ? "" : "s"}`}
            </div>
            {data?.block && <div className="text-[11px] text-faint font-mono">block {data.block}</div>}
            {data?.attestor && <div className="text-[11px] text-faint font-mono ml-auto">attestor {short(data.attestor)}</div>}
          </div>

          {loading && <div className="text-[13px] text-faint text-center py-10">Reading Robinhood Chain and signing each token…</div>}
          {!loading && tokens.length === 0 && <div className="text-[13px] text-faint text-center py-10">Couldn&apos;t reach Robinhood Chain right now.</div>}

          <div className="mt-3 grid sm:grid-cols-2 gap-2">
            {tokens.map((t) => {
              const st = checked[t.ticker];
              return (
                <div key={t.contract} className="glass rounded-xl px-4 py-3.5 border border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <div className="text-[15px] font-bold tracking-tight">{t.ticker}</div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-faint uppercase tracking-wider">{t.asset_class}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#22c98a]/15 text-[#5ee68f]">SIGNA-signed</span>
                    <div className="ml-auto text-[14px] font-semibold">{px(t.market.price_usd)}</div>
                  </div>
                  <div className="text-[12px] text-muted mt-0.5 truncate">{t.company}</div>

                  <div className="mt-2.5 grid grid-cols-3 gap-2 text-[11px]">
                    <div><div className="text-faint">supply</div><div className="text-white/90 font-medium">{amt(t.supply_display)}</div></div>
                    <div><div className="text-faint">mkt cap</div><div className="text-white/90 font-medium">{usd(t.market.market_cap)}</div></div>
                    <div><div className="text-faint">holders</div><div className="text-white/90 font-medium">{t.market.holders?.toLocaleString() ?? "—"}</div></div>
                  </div>

                  <div className="mt-2.5 flex items-center gap-2">
                    <a href={t.explorer} target="_blank" rel="noopener noreferrer" className="text-[11px] font-mono text-[#a5c3ff] hover:underline">{short(t.contract)}</a>
                    <button
                      onClick={() => verifyOne(t)}
                      className={`ml-auto text-[11px] px-2 py-1 rounded-md font-medium transition-colors ${
                        st === "ok" ? "bg-[#22c98a]/15 text-[#5ee68f]" : st === "bad" ? "bg-red-500/15 text-red-300" : "bg-white/[0.06] text-white/60 hover:text-white hover:bg-white/[0.1]"
                      }`}
                    >
                      {st === "ok" ? "re-verified ✓" : st === "bad" ? "failed ×" : st === "checking" ? "checking…" : "verify"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-[11px] text-faint mt-10 leading-relaxed">
          Each attestation is an EIP-191 signature by SIGNA&apos;s RWA attestor over the canonical contract and its onchain supply at a
          named block, re-verifiable at /verify (kind <span className="font-mono">rwa_attestation</span>) or locally with
          viem.recoverMessageAddress. Price, market cap and holder counts are read from the Robinhood Chain explorer for context and are
          deliberately <span className="text-white/70">not</span> part of the signed claim — only what is checkable onchain is signed.
          SIGNA is not affiliated with Robinhood; it mints nothing and custodies nothing. Not investment advice. signaagent.xyz/rwa
        </p>
      </div>
    </div>
  );
}
