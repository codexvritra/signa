"use client";

import { useEffect, useState } from "react";
import { RH_CHAIN_ID_HEX, RH_RPC, RH_CHAIN_NAME, RH_EXPLORER, RH_CHAIN_ID } from "@/lib/chain";
import { liveLaunchFeeWei, previewEconomics, buildPonsLaunchCalldata, randomSalt, NATIVE_PAIR, DEFAULT_LAUNCH_CONFIG_ID, DEFAULT_CREATOR_TAX_BPS, PONS_FACTORY } from "@/lib/pons";

/**
 * /launch — launch a token straight on Pons's own factory (Robinhood Chain),
 * no redirect to ponsfamily.com. 2% of every trade routes to Sigda by
 * default (Pons's native "creator tax"), and the token gets a live onchain
 * agent the moment it launches. Nothing custodial — your wallet signs and
 * pays for the launch tx directly against Pons's contract.
 */
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export default function LaunchPage() {
  const [account, setAccount] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [desc, setDesc] = useState("");
  const [tw, setTw] = useState("");
  const [tg, setTg] = useState("");
  const [site, setSite] = useState("");
  const [feeWei, setFeeWei] = useState<bigint>(500000000000000n);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ k: "ok" | "err" | "info"; t: string } | null>(null);

  const provider = () => {
    if (typeof window === "undefined") return null;
    const w = window as any;
    const eth = w.ethereum;
    if (eth?.providers?.length) return eth.providers.find((p: any) => p.isMetaMask) || eth.providers[0];
    return eth || w.okxwallet || w.coinbaseWalletExtension || null;
  };

  useEffect(() => {
    liveLaunchFeeWei().then(setFeeWei).catch(() => {});
    const p = provider();
    if (!p) return;
    p.request({ method: "eth_accounts" }).then((a: string[]) => { if (a?.[0]) setAccount(a[0].toLowerCase()); }).catch(() => {});
  }, []);

  async function ensureChain(p: any) {
    try { await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: RH_CHAIN_ID_HEX }] }); }
    catch { await p.request({ method: "wallet_addEthereumChain", params: [{ chainId: RH_CHAIN_ID_HEX, chainName: RH_CHAIN_NAME, nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: [RH_RPC], blockExplorerUrls: RH_EXPLORER ? [RH_EXPLORER] : [] }] }); }
  }

  async function connect() {
    const p = provider();
    if (!p) { setStatus({ k: "err", t: "No wallet detected. Install MetaMask/OKX, or open sigda.xyz/launch in your wallet's browser." }); return; }
    try {
      const a = await p.request({ method: "eth_requestAccounts" });
      if (!a?.[0]) { setStatus({ k: "err", t: "Wallet returned no account." }); return; }
      setAccount(String(a[0]).toLowerCase());
      ensureChain(p).catch(() => {});
    } catch (e: any) {
      setStatus({ k: "err", t: e?.code === 4001 ? "You rejected the connection." : "Couldn't connect — unlock your wallet and try again." });
    }
  }

  async function launch() {
    const p = provider();
    if (!p || !account) { connect(); return; }
    const n = name.trim(), s = symbol.trim().toUpperCase();
    if (!n || !s) { setStatus({ k: "err", t: "Name and ticker are required." }); return; }
    setBusy(true);
    setStatus({ k: "info", t: "Reading current launch economics…" });
    try {
      await ensureChain(p);
      const expectedEconomics = await previewEconomics(DEFAULT_LAUNCH_CONFIG_ID, NATIVE_PAIR);
      const salt = randomSalt();
      const data = buildPonsLaunchCalldata(
        { name: n, symbol: s, description: desc, socials: { twitter: tw, telegram: tg, website: site } },
        DEFAULT_LAUNCH_CONFIG_ID,
        NATIVE_PAIR,
        expectedEconomics,
        salt,
      );
      setStatus({ k: "info", t: "Confirm the launch in your wallet…" });
      const value = "0x" + feeWei.toString(16);
      const hash = await p.request({ method: "eth_sendTransaction", params: [{ from: account, to: PONS_FACTORY, data, value }] });
      setStatus({ k: "info", t: "Launched — waiting for confirmation…" });

      let registered = false;
      for (let i = 0; i < 10 && !registered; i++) {
        await new Promise((r) => setTimeout(r, 4000));
        const j = await (await fetch("/api/launch/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tx: hash, symbol: s }) })).json();
        if (j.ok) { registered = true; setStatus({ k: "ok", t: `$${s} is live — its agent just spoke for the first time. See /launches.` }); }
      }
      if (!registered) setStatus({ k: "ok", t: `Launched ✓ (tx ${hash.slice(0, 12)}…) — its agent will appear on /launches once confirmed.` });
      setName(""); setSymbol(""); setDesc(""); setTw(""); setTg(""); setSite("");
    } catch (e: any) {
      setStatus({ k: "err", t: /reject|denied/i.test(e?.message || "") ? "Transaction rejected." : `Launch failed — you need ETH on Robinhood Chain for the ${(Number(feeWei) / 1e18).toFixed(4)} ETH launch fee + gas.` });
    }
    setBusy(false);
  }

  const feeEth = (Number(feeWei) / 1e18).toFixed(4);

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-[720px] mx-auto px-5 py-12 sm:py-16">
        <div className="text-[12px] uppercase tracking-[0.2em] text-[var(--accent)] font-semibold">Launch · Pons · Robinhood Chain</div>
        <h1 className="text-[34px] sm:text-[44px] font-bold leading-tight mt-1 tracking-tight">Launch a token. It comes alive.</h1>
        <p className="text-[15px] text-muted mt-3 leading-relaxed max-w-[600px]">
          This launches directly on Pons&apos;s own contract — no redirect, your wallet signs it. The moment it launches, it gets a
          live onchain agent that researches its own token and signs its own thoughts. 2% of every trade routes to Sigda
          (Pons&apos;s built-in creator tax), funding the agent network.
        </p>

        <div className="mt-6 glass rounded-2xl p-5 border border-white/[0.07] flex flex-col gap-2">
          <div className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Token name" className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-[var(--accent)]/60" />
            <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="TICKER" maxLength={10} className="w-28 bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-[var(--accent)]/60" />
          </div>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Short description" className="bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-[var(--accent)]/60" />
          <div className="grid grid-cols-3 gap-2">
            <input value={tw} onChange={(e) => setTw(e.target.value)} placeholder="X / Twitter link" className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]/60" />
            <input value={tg} onChange={(e) => setTg(e.target.value)} placeholder="Telegram link" className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]/60" />
            <input value={site} onChange={(e) => setSite(e.target.value)} placeholder="Website" className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]/60" />
          </div>

          {account ? (
            <button onClick={launch} disabled={busy} className="w-full mt-2 px-4 py-3 rounded-xl text-[15px] font-semibold bg-[var(--accent)] text-black disabled:opacity-60 hover:brightness-95">
              {busy ? "launching…" : `Launch token · ${feeEth} ETH fee`}
            </button>
          ) : (
            <button onClick={connect} className="w-full mt-2 px-4 py-3 rounded-xl text-[15px] font-semibold bg-[var(--accent)] text-black hover:brightness-95">Connect wallet</button>
          )}
          {account && <div className="text-[11px] text-faint font-mono">{short(account)} · {RH_CHAIN_NAME} (chain {RH_CHAIN_ID})</div>}
        </div>

        {status && (
          <div className={`mt-4 text-[13px] rounded-lg px-3 py-2.5 break-words ${status.k === "ok" ? "bg-[#22c98a]/10 text-[#bdf5d2] border border-[#5ee68f]/30" : status.k === "err" ? "bg-red-500/10 text-red-300 border border-red-500/30" : "bg-white/[0.05] text-faint"}`}>
            {status.t}
          </div>
        )}

        <p className="text-[11px] text-faint mt-10">
          Launches go straight to Pons&apos;s verified factory contract on Robinhood Chain — Sigda never holds your funds or keys.
          Trade fee is 3% total (1% Pons base + 2% creator tax routed to Sigda). Not affiliated with Robinhood or Pons.
        </p>
      </div>
    </div>
  );
}
