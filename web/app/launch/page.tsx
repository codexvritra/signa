"use client";

import { useEffect, useState, useCallback } from "react";
import {
  buildLaunchCalldata, launchReceiptPreimage, listLaunches, launchpadLive,
  SIGNA_LAUNCH_ADDRESS, RH_CHAIN_ID, RH_CHAIN_ID_HEX, RH_RPC, RH_CHAIN_NAME, RH_EXPLORER,
  explorerTx, explorerToken, type Launch,
} from "@/lib/signa-launch";

/**
 * /launch — SIGNA verifiable token launchpad on Robinhood Chain.
 * Launch a fixed-supply token (full supply to you, non-custodial), get a
 * wallet-signed launch receipt (SIGNA proves who launched what), add liquidity
 * on Uniswap. Uses the injected provider directly (RH Chain, ETH gas).
 */
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
const fmt = (wei: string) => { try { return (BigInt(wei) / 10n ** 18n).toLocaleString(); } catch { return wei; } };

export default function LaunchPage() {
  const [account, setAccount] = useState<string>("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [supply, setSupply] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ k: "ok" | "err" | "info"; t: string; tx?: string; token?: string } | null>(null);
  const [launches, setLaunches] = useState<Launch[]>([]);

  const provider = () => (typeof window !== "undefined" ? (window as any).ethereum : null);

  const load = useCallback(async () => {
    try { const j = await (await fetch("/api/launchpad", { cache: "no-store" })).json(); if (j.ok) setLaunches(j.launches ?? []); } catch {}
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  async function connect() {
    const p = provider();
    if (!p) { setStatus({ k: "err", t: "No wallet found — open in a wallet browser or install an extension." }); return; }
    try {
      const accts = await p.request({ method: "eth_requestAccounts" });
      setAccount(String(accts[0]).toLowerCase());
      await ensureChain(p);
    } catch (e: any) { setStatus({ k: "err", t: "Connect rejected." }); }
  }

  async function ensureChain(p: any) {
    try {
      await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: RH_CHAIN_ID_HEX }] });
    } catch {
      await p.request({ method: "wallet_addEthereumChain", params: [{
        chainId: RH_CHAIN_ID_HEX, chainName: RH_CHAIN_NAME,
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: [RH_RPC], blockExplorerUrls: RH_EXPLORER ? [RH_EXPLORER] : [],
      }]});
    }
  }

  async function launch() {
    const p = provider();
    if (!p || !account) { connect(); return; }
    const n = name.trim(), s = symbol.trim().toUpperCase(), sup = supply.trim();
    if (!n || !s) { setStatus({ k: "err", t: "Name and ticker are required." }); return; }
    if (!/^\d+$/.test(sup) || BigInt(sup) === 0n) { setStatus({ k: "err", t: "Supply must be a whole number of tokens." }); return; }
    if (!launchpadLive) { setStatus({ k: "err", t: "The launchpad factory isn't deployed on Robinhood Chain yet — coming shortly." }); return; }
    setBusy(true); setStatus({ k: "info", t: "Confirm the launch in your wallet…" });
    try {
      await ensureChain(p);
      const data = buildLaunchCalldata(n, s, BigInt(sup));
      const hash = await p.request({ method: "eth_sendTransaction", params: [{ from: account, to: SIGNA_LAUNCH_ADDRESS, data, value: "0x0" }] });
      setStatus({ k: "ok", t: `Launched ${s} on ${RH_CHAIN_NAME} ✓ — full supply is in your wallet. Add liquidity on Uniswap to open trading.`, tx: hash });
      setName(""); setSymbol(""); setSupply("");
      setTimeout(load, 4000);
    } catch (e: any) {
      setStatus({ k: "err", t: /reject|denied/i.test(e?.message || "") ? "Transaction rejected." : "Launch failed — you need a little ETH on Robinhood Chain for gas (gas is subsidized for eligible wallets)." });
    }
    setBusy(false);
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-[680px] mx-auto px-5 py-12 sm:py-16">
        <div className="text-[12px] uppercase tracking-[0.2em] text-[#a98bff] font-semibold">Launchpad · Robinhood Chain</div>
        <h1 className="text-[34px] sm:text-[44px] font-bold leading-tight mt-1 tracking-tight">Launch a token, <span className="bg-gradient-to-r from-[#6ea2ff] to-[#a98bff] bg-clip-text text-transparent">prove who did.</span></h1>
        <p className="text-[15px] text-muted mt-3 leading-relaxed max-w-[600px]">
          A verifiable, non-custodial launchpad on Robinhood Chain. You launch a fixed-supply token, the <span className="text-white">entire supply mints to your wallet</span>, and the launch is recorded on-chain as proof of who launched what. SIGNA holds nothing and takes no fee — you add liquidity on Uniswap. Not affiliated with Robinhood; built on their public chain.
        </p>

        {!launchpadLive && (
          <div className="mt-5 glass rounded-xl p-3.5 border border-amber-400/25 text-[13px] text-amber-200">
            The launch factory is being deployed to Robinhood Chain — the form goes live the moment it&apos;s up. You can preview the flow below.
          </div>
        )}

        {/* create */}
        <div className="mt-6 glass rounded-2xl p-5 border border-white/[0.07]">
          <div className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Token name" className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-[#a98bff]/60" />
            <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="TICKER" maxLength={11} className="w-32 bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-[#a98bff]/60" />
          </div>
          <input value={supply} onChange={(e) => setSupply(e.target.value.replace(/[^\d]/g, ""))} placeholder="Total supply (whole tokens, e.g. 1000000000)" inputMode="numeric" className="w-full mt-2 bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-[#a98bff]/60" />
          {account ? (
            <button onClick={launch} disabled={busy} className="w-full mt-3 px-4 py-3 rounded-xl text-[15px] font-semibold bg-gradient-to-r from-[#7c3aed] to-[#3b6fe0] text-white disabled:opacity-60 hover:brightness-110">{busy ? "launching…" : "Launch token"}</button>
          ) : (
            <button onClick={connect} className="w-full mt-3 px-4 py-3 rounded-xl text-[15px] font-semibold bg-gradient-to-r from-[#7c3aed] to-[#3b6fe0] text-white hover:brightness-110">Connect wallet</button>
          )}
          {account && <div className="text-[11px] text-faint mt-2 font-mono">connected {short(account)} · will switch to {RH_CHAIN_NAME} (chain {RH_CHAIN_ID})</div>}
        </div>

        {status && (
          <div className={`mt-4 text-[13px] rounded-lg px-3 py-2.5 break-words ${status.k === "ok" ? "bg-[#22c98a]/10 text-[#bdf5d2] border border-[#5ee68f]/30" : status.k === "err" ? "bg-red-500/10 text-red-300 border border-red-500/30" : "bg-white/[0.05] text-faint"}`}>
            {status.t}
            {status.tx && explorerTx(status.tx) && <> · <a href={explorerTx(status.tx)} target="_blank" rel="noreferrer" className="underline text-[#5ee68f]">view tx ↗</a></>}
          </div>
        )}

        {/* feed */}
        <div className="mt-8">
          <div className="text-[12px] uppercase tracking-[0.18em] text-faint font-semibold">{launches.length} launch{launches.length === 1 ? "" : "es"}</div>
          <div className="mt-3 flex flex-col gap-2">
            {launches.length === 0 && <div className="text-[13px] text-faint text-center py-8">{launchpadLive ? "No launches yet — be the first." : "Launches appear here once the factory is live."}</div>}
            {launches.map((l) => (
              <div key={l.token} className="glass rounded-xl px-4 py-3.5 border border-white/[0.06] flex items-center gap-3">
                <div className="size-9 rounded-lg bg-gradient-to-br from-[#7c3aed] to-[#3b6fe0] flex items-center justify-center text-[14px] font-bold text-white shrink-0">{l.symbol[0]}</div>
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold truncate">{l.name} <span className="text-faint font-normal">${l.symbol}</span></div>
                  <div className="text-[11px] text-faint font-mono">{fmt(l.supply)} supply · by {short(l.launcher)}</div>
                </div>
                {explorerToken(l.token) && <a href={explorerToken(l.token)} target="_blank" rel="noreferrer" className="ml-auto text-[12px] text-[#5ee68f] underline shrink-0">token ↗</a>}
              </div>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-faint mt-10">
          Fixed-supply tokens minted once to the launcher (no owner, no post-mint) via the ownerless SignaLaunch factory on Robinhood Chain — every launch is a Launched event, provable forever. SIGNA is not affiliated with Robinhood; this is built on their public chain. signaagent.xyz/launch
        </p>
      </div>
    </div>
  );
}
