"use client";

import { useEffect, useState } from "react";
import { RH_CHAIN_ID_HEX, RH_RPC, RH_CHAIN_NAME, RH_EXPLORER, RH_CHAIN_ID } from "@/lib/chain";
import { liveLaunchFeeWei, previewEconomics, buildPonsLaunchCalldata, randomSalt, NATIVE_PAIR, DEFAULT_LAUNCH_CONFIG_ID, DEFAULT_CREATOR_TAX_BPS, PONS_FACTORY } from "@/lib/pons";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";
import "@/app/marketing.css";

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
    <div className="p min-h-screen flex flex-col">
      <AppHeader light />
      <main className="flex-1">
        <section className="hero" style={{ paddingBottom: 64 }}>
          <div className="shell" style={{ maxWidth: 720 }}>
            <span className="chip">Launch · Pons · Robinhood Chain</span>
            <h1 style={{ fontSize: "clamp(28px, 4.2vw, 42px)" }}>Launch a token. It comes alive.</h1>
            <p className="sub" style={{ marginBottom: 0 }}>Your wallet signs it — no redirect, no custody.</p>

            <div className="panel" style={{ marginTop: 26, padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Token name" className="tryit-input" style={{ flex: 1, height: 46 }} />
                <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="TICKER" maxLength={10} className="tryit-input" style={{ width: 120, height: 46 }} />
              </div>
              <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Short description" className="tryit-input" style={{ height: 46 }} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                <input value={tw} onChange={(e) => setTw(e.target.value)} placeholder="X / Twitter link" className="tryit-input" style={{ height: 42, fontSize: 13 }} />
                <input value={tg} onChange={(e) => setTg(e.target.value)} placeholder="Telegram link" className="tryit-input" style={{ height: 42, fontSize: 13 }} />
                <input value={site} onChange={(e) => setSite(e.target.value)} placeholder="Website" className="tryit-input" style={{ height: 42, fontSize: 13 }} />
              </div>

              {account ? (
                <button onClick={launch} disabled={busy} className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 4 }}>
                  {busy ? "launching…" : `Launch token · ${feeEth} ETH fee`}
                </button>
              ) : (
                <button onClick={connect} className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 4 }}>Connect wallet</button>
              )}
              {account && <div className="hero-note" style={{ margin: 0 }}>{short(account)} · {RH_CHAIN_NAME} (chain {RH_CHAIN_ID})</div>}
            </div>

            {status && (
              <div className={`tryit-note${status.k === "err" ? " err" : ""}`} style={{ marginTop: 18 }}>
                {status.t}
              </div>
            )}

            <p style={{ marginTop: 40, fontSize: 12.5, lineHeight: 1.6, color: "var(--ink-soft)" }}>
              Launches go straight to Pons&apos;s verified factory contract on Robinhood Chain — Sigda never holds your funds or keys.
              Trade fee is 3% total (1% Pons base + 2% creator tax routed to Sigda). Not affiliated with Robinhood or Pons.
            </p>
          </div>
        </section>
      </main>
      <Footer light />
    </div>
  );
}
