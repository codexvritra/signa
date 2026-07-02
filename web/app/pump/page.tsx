"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { buildLaunchCalldata, SIGNA_PUMP_ADDRESS, pumpLive } from "@/lib/pump";
import { RH_CHAIN_ID, RH_CHAIN_ID_HEX, RH_RPC, RH_CHAIN_NAME, RH_EXPLORER } from "@/lib/signa-launch";
import PumpNotifications from "@/components/pump/PumpNotifications";

/**
 * /pump — pump.fun/ape.store-style bonding-curve launchpad on Robinhood Chain.
 * Create a token (name, ticker, image, TG/X, description) → launches on the
 * SignaPump curve for a flat fee → trades on the curve (2% fee, 1% creator /
 * 1% platform) → graduates to Uniswap at 3 ETH.  ⚠️ testnet until audited.
 */
type Tok = { token: string; name: string; symbol: string; creator: string; meta?: { image_url?: string; description?: string } | null };
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export default function PumpPage() {
  const [account, setAccount] = useState("");
  const [name, setName] = useState(""); const [symbol, setSymbol] = useState(""); const [desc, setDesc] = useState("");
  const [tg, setTg] = useState(""); const [tw, setTw] = useState(""); const [site, setSite] = useState("");
  const [imageUrl, setImageUrl] = useState(""); const [uploading, setUploading] = useState(false);
  const [feeWei, setFeeWei] = useState("0");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ k: "ok" | "err" | "info"; t: string } | null>(null);
  const [tokens, setTokens] = useState<Tok[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const provider = () => {
    if (typeof window === "undefined") return null;
    const w = window as any;
    const eth = w.ethereum;
    if (eth?.providers?.length) return eth.providers.find((p: any) => p.isMetaMask) || eth.providers[0];
    return eth || w.okxwallet || w.coinbaseWalletExtension || null;
  };

  const load = useCallback(async () => {
    try { const j = await (await fetch("/api/pump", { cache: "no-store" })).json(); if (j.ok) { setTokens(j.tokens ?? []); setFeeWei(j.launch_fee_wei ?? "0"); } } catch {}
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 25000); return () => clearInterval(t); }, [load]);
  // reflect an already-connected wallet on load
  useEffect(() => { const p = provider(); if (!p) return; p.request({ method: "eth_accounts" }).then((a: string[]) => { if (a?.[0]) setAccount(a[0].toLowerCase()); }).catch(() => {}); }, []);

  async function connect() {
    const p = provider();
    if (!p) { setStatus({ k: "err", t: "No wallet detected. Install MetaMask or OKX, or open signaagent.xyz/pump inside your wallet's built-in browser." }); return; }
    try {
      const a = await p.request({ method: "eth_requestAccounts" });
      if (!a?.[0]) { setStatus({ k: "err", t: "Wallet returned no account — unlock it and try again." }); return; }
      setAccount(String(a[0]).toLowerCase());
      setStatus({ k: "ok", t: "Wallet connected. It'll switch to Robinhood Chain when you launch." });
      ensureChain(p).catch(() => {}); // best-effort; don't fail the connect if network-add is declined
    } catch (e: any) {
      setStatus({ k: "err", t: e?.code === 4001 ? "You rejected the connection in your wallet." : "Couldn't connect — make sure your wallet is unlocked." });
    }
  }
  async function ensureChain(p: any) {
    try { await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: RH_CHAIN_ID_HEX }] }); }
    catch { await p.request({ method: "wallet_addEthereumChain", params: [{ chainId: RH_CHAIN_ID_HEX, chainName: RH_CHAIN_NAME, nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: [RH_RPC], blockExplorerUrls: RH_EXPLORER ? [RH_EXPLORER] : [] }] }); }
  }

  // one-click: push the Robinhood Chain network config into the wallet (it's a
  // brand-new chain, so no wallet ships it by default)
  async function addChain() {
    const p = provider();
    if (!p) { setStatus({ k: "err", t: "No wallet detected — install MetaMask/OKX or open this in your wallet's browser." }); return; }
    try {
      await ensureChain(p);
      setStatus({ k: "ok", t: `${RH_CHAIN_NAME} added to your wallet ✓ (chain ${RH_CHAIN_ID})` });
    } catch (e: any) {
      setStatus({ k: "err", t: e?.code === 4001 ? "You declined adding the network." : "Wallet refused the network add — add it manually (see below)." });
    }
  }

  async function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 1_500_000) { setStatus({ k: "err", t: "Image must be under 1.5 MB." }); return; }
    setUploading(true); setStatus({ k: "info", t: "Uploading image…" });
    try {
      const b64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] || ""); r.onerror = rej; r.readAsDataURL(f); });
      const j = await (await fetch("/api/pump/upload", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: b64, contentType: f.type }) })).json();
      if (j.ok) { setImageUrl(j.url); setStatus({ k: "ok", t: "Image uploaded." }); } else setStatus({ k: "err", t: j.error || "upload failed" });
    } catch { setStatus({ k: "err", t: "Upload failed." }); }
    setUploading(false);
  }

  async function launch() {
    const p = provider();
    if (!p || !account) { connect(); return; }
    const n = name.trim(), s = symbol.trim().toUpperCase();
    if (!n || !s) { setStatus({ k: "err", t: "Name and ticker are required." }); return; }
    if (!pumpLive) { setStatus({ k: "err", t: "The bonding-curve launchpad isn't deployed on Robinhood Chain yet — coming shortly." }); return; }
    setBusy(true); setStatus({ k: "info", t: "Confirm the launch in your wallet…" });
    try {
      await ensureChain(p);
      const value = "0x" + BigInt(feeWei || "0").toString(16);
      const data = buildLaunchCalldata(n, s);
      const hash = await p.request({ method: "eth_sendTransaction", params: [{ from: account, to: SIGNA_PUMP_ADDRESS, data, value }] });
      setStatus({ k: "info", t: "Launched — saving your token page…" });
      // server resolves token+creator from the launch tx, then stores metadata
      let saved = false;
      for (let i = 0; i < 8 && !saved; i++) {
        await new Promise((r) => setTimeout(r, 4000));
        const j = await (await fetch("/api/pump", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ launch_tx: hash, name: n, symbol: s, description: desc, image_url: imageUrl, telegram: tg, twitter: tw, website: site }) })).json();
        if (j.ok) { saved = true; setStatus({ k: "ok", t: `${s} launched on the curve ✓ — it's live for trading.` }); }
      }
      if (!saved) setStatus({ k: "ok", t: `Launched ✓ (tx ${hash.slice(0, 12)}…) — token page will appear once indexed.` });
      setName(""); setSymbol(""); setDesc(""); setTg(""); setTw(""); setSite(""); setImageUrl(""); if (fileRef.current) fileRef.current.value = "";
      load();
    } catch (e: any) {
      setStatus({ k: "err", t: /reject|denied/i.test(e?.message || "") ? "Transaction rejected." : "Launch failed — you need ETH on Robinhood Chain for the launch fee + gas (gas subsidized for eligible wallets)." });
    }
    setBusy(false);
  }

  const feeEth = (() => { try { return (Number(BigInt(feeWei) / 10n ** 12n) / 1e6).toString(); } catch { return "0"; } })();

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <PumpNotifications />
      <div className="max-w-[720px] mx-auto px-5 py-12 sm:py-16">
        <div className="text-[12px] uppercase tracking-[0.2em] text-[#a98bff] font-semibold">Pump · bonding curve · Robinhood Chain</div>
        <h1 className="text-[34px] sm:text-[44px] font-bold leading-tight mt-1 tracking-tight">Launch a coin. <span className="bg-gradient-to-r from-[#6ea2ff] to-[#a98bff] bg-clip-text text-transparent">Fair curve.</span></h1>
        <p className="text-[15px] text-muted mt-3 leading-relaxed max-w-[600px]">
          Launch a token on a bonding curve — it trades instantly, price rises as people buy, and at <span className="text-white">3 ETH</span> it graduates to Uniswap (and shows on DexScreener). Trading fee is 2%: <span className="text-white">1% to you as creator</span>, 1% to the platform. Not affiliated with Robinhood; built on their public chain.
        </p>

        {!pumpLive && (
          <div className="mt-5 glass rounded-xl p-3.5 border border-amber-400/25 text-[13px] text-amber-200">
            The bonding-curve contract is being deployed + audited for Robinhood Chain — the form goes live once it&apos;s up. Preview the flow below.
          </div>
        )}

        {/* create */}
        <div className="mt-6 glass rounded-2xl p-5 border border-white/[0.07]">
          <div className="flex gap-3">
            <div onClick={() => fileRef.current?.click()} className="size-20 rounded-xl border border-dashed border-white/20 flex items-center justify-center cursor-pointer overflow-hidden shrink-0 bg-black/30 hover:border-[#a98bff]/50">
              {imageUrl ? <img src={imageUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-[11px] text-faint text-center px-1">{uploading ? "…" : "upload image"}</span>}
            </div>
            <div className="flex-1 flex flex-col gap-2">
              <div className="flex gap-2">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Token name" className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-[#a98bff]/60" />
                <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="TICKER" maxLength={11} className="w-28 bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-[#a98bff]/60" />
              </div>
              <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Short description" className="bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-[#a98bff]/60" />
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={onImage} className="hidden" />
          <div className="grid grid-cols-3 gap-2 mt-2">
            <input value={tw} onChange={(e) => setTw(e.target.value)} placeholder="X / Twitter link" className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-[#a98bff]/60" />
            <input value={tg} onChange={(e) => setTg(e.target.value)} placeholder="Telegram link" className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-[#a98bff]/60" />
            <input value={site} onChange={(e) => setSite(e.target.value)} placeholder="Website" className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-[#a98bff]/60" />
          </div>
          {account ? (
            <button onClick={launch} disabled={busy || uploading} className="w-full mt-3 px-4 py-3 rounded-xl text-[15px] font-semibold bg-gradient-to-r from-[#7c3aed] to-[#3b6fe0] text-white disabled:opacity-60 hover:brightness-110">{busy ? "launching…" : `Launch token${feeEth !== "0" ? ` · ${feeEth} ETH fee` : ""}`}</button>
          ) : (
            <button onClick={connect} className="w-full mt-3 px-4 py-3 rounded-xl text-[15px] font-semibold bg-gradient-to-r from-[#7c3aed] to-[#3b6fe0] text-white hover:brightness-110">Connect wallet</button>
          )}
          <div className="mt-2 flex items-center gap-3">
            {account && <span className="text-[11px] text-faint font-mono">{short(account)} · {RH_CHAIN_NAME} (chain {RH_CHAIN_ID})</span>}
            <button onClick={addChain} className="text-[11px] text-[#a98bff] underline">+ Add Robinhood Chain to wallet</button>
          </div>
        </div>

        {status && <div className={`mt-4 text-[13px] rounded-lg px-3 py-2.5 break-words ${status.k === "ok" ? "bg-[#22c98a]/10 text-[#bdf5d2] border border-[#5ee68f]/30" : status.k === "err" ? "bg-red-500/10 text-red-300 border border-red-500/30" : "bg-white/[0.05] text-faint"}`}>{status.t}</div>}

        {/* feed */}
        <div className="mt-8">
          <div className="text-[12px] uppercase tracking-[0.18em] text-faint font-semibold">{tokens.length} coin{tokens.length === 1 ? "" : "s"}</div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {tokens.length === 0 && <div className="text-[13px] text-faint text-center py-8 col-span-full">{pumpLive ? "No coins yet — launch the first." : "Coins appear here once the launchpad is live."}</div>}
            {tokens.map((t) => (
              <a key={t.token} href={`/pump/${t.token}`} className="glass rounded-xl px-4 py-3.5 border border-white/[0.06] hover:border-[#a98bff]/30 flex items-center gap-3">
                <div className="size-11 rounded-lg overflow-hidden bg-gradient-to-br from-[#7c3aed] to-[#3b6fe0] flex items-center justify-center text-[15px] font-bold text-white shrink-0">
                  {t.meta?.image_url ? <img src={t.meta.image_url} alt="" className="w-full h-full object-cover" /> : (t.symbol?.[0] || "?")}
                </div>
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold truncate">{t.name} <span className="text-faint font-normal">${t.symbol}</span></div>
                  <div className="text-[11px] text-faint truncate">{t.meta?.description || short(t.token)}</div>
                </div>
              </a>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-faint mt-10">
          Bonding curve on the SignaPump contract (Robinhood Chain). ⚠️ Custodial contract on testnet pending audit — never trade real funds until audited. 2% trade fee (1% creator / 1% platform); graduates to Uniswap at 3 ETH. SIGNA is not affiliated with Robinhood. signaagent.xyz/pump
        </p>
      </div>
    </div>
  );
}
