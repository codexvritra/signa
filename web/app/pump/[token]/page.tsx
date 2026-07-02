"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { parseEther, formatEther } from "viem";
import { buildBuyCalldata, buildSellCalldata, buildApproveCalldata, buildBalanceOfCalldata, SIGNA_PUMP_ADDRESS, pumpLive } from "@/lib/pump";
import { RH_CHAIN_ID_HEX, RH_RPC, RH_CHAIN_NAME, RH_EXPLORER } from "@/lib/signa-launch";
import PumpNotifications from "@/components/pump/PumpNotifications";

type Trade = { isBuy: boolean; eth: string; tokens: string; priceE18: string; timestamp: number; tx: string };
type Data = { meta?: any; chain?: { raised: string; threshold: string; graduated: boolean; priceE18: string } | null; trades?: Trade[]; contract?: string | null };
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

// aggregate trades into OHLC candles
function candles(trades: Trade[], n = 32) {
  if (!trades.length) return [] as { o: number; h: number; l: number; c: number }[];
  const t0 = trades[0].timestamp, t1 = trades[trades.length - 1].timestamp;
  const size = Math.max(1, (t1 - t0) / n);
  const buckets = new Map<number, { o: number; h: number; l: number; c: number }>();
  for (const tr of trades) {
    const price = Number(BigInt(tr.priceE18)) / 1e18;
    const b = Math.min(n - 1, Math.floor((tr.timestamp - t0) / size));
    const cur = buckets.get(b);
    if (!cur) buckets.set(b, { o: price, h: price, l: price, c: price });
    else { cur.h = Math.max(cur.h, price); cur.l = Math.min(cur.l, price); cur.c = price; }
  }
  return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
}

function Candles({ trades }: { trades: Trade[] }) {
  const cs = candles(trades);
  if (cs.length < 2) return <div className="h-[200px] flex items-center justify-center text-[13px] text-faint">Chart appears after a few trades.</div>;
  const W = 640, H = 200, pad = 8;
  const hi = Math.max(...cs.map((c) => c.h)), lo = Math.min(...cs.map((c) => c.l));
  const rng = Math.max(hi - lo, hi * 1e-6 || 1e-9);
  const y = (v: number) => pad + (H - 2 * pad) * (1 - (v - lo) / rng);
  const cw = (W - 2 * pad) / cs.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[200px]" preserveAspectRatio="none">
      {cs.map((c, i) => {
        const x = pad + i * cw + cw / 2;
        const up = c.c >= c.o;
        const col = up ? "#5ee68f" : "#ff6b6b";
        const bodyT = y(Math.max(c.o, c.c)), bodyB = y(Math.min(c.o, c.c));
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={y(c.h)} y2={y(c.l)} stroke={col} strokeWidth="1" />
            <rect x={x - cw * 0.3} y={bodyT} width={cw * 0.6} height={Math.max(1, bodyB - bodyT)} fill={col} />
          </g>
        );
      })}
    </svg>
  );
}

export default function TokenPage() {
  const params = useParams();
  const token = String((params as any)?.token ?? "").toLowerCase();
  const [d, setD] = useState<Data | null>(null);
  const [account, setAccount] = useState("");
  const [bal, setBal] = useState<string>("0");
  const [buyEth, setBuyEth] = useState(""); const [sellTok, setSellTok] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ k: "ok" | "err" | "info"; t: string } | null>(null);

  const provider = () => (typeof window !== "undefined" ? (window as any).ethereum : null);
  const load = useCallback(async () => {
    try { const j = await (await fetch(`/api/pump?token=${token}`, { cache: "no-store" })).json(); if (j.ok) setD(j); } catch {}
  }, [token]);
  useEffect(() => { load(); const t = setInterval(load, 12000); return () => clearInterval(t); }, [load]);

  const readBal = useCallback(async (acct: string) => {
    const p = provider(); if (!p || !acct) return;
    try { const r = await p.request({ method: "eth_call", params: [{ to: token, data: buildBalanceOfCalldata(acct) }, "latest"] }); setBal(BigInt(r || "0x0").toString()); } catch {}
  }, [token]);

  async function ensureChain(p: any) {
    try { await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: RH_CHAIN_ID_HEX }] }); }
    catch { await p.request({ method: "wallet_addEthereumChain", params: [{ chainId: RH_CHAIN_ID_HEX, chainName: RH_CHAIN_NAME, nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: [RH_RPC], blockExplorerUrls: RH_EXPLORER ? [RH_EXPLORER] : [] }] }); }
  }
  async function connect() {
    const p = provider(); if (!p) { setStatus({ k: "err", t: "No wallet found." }); return; }
    try { const a = await p.request({ method: "eth_requestAccounts" }); const acct = String(a[0]).toLowerCase(); setAccount(acct); await ensureChain(p); readBal(acct); } catch { setStatus({ k: "err", t: "Connect rejected." }); }
  }

  async function buy() {
    const p = provider(); if (!p || !account) return connect();
    if (!/^\d*\.?\d+$/.test(buyEth.trim())) { setStatus({ k: "err", t: "Enter an ETH amount." }); return; }
    setBusy(true); setStatus({ k: "info", t: "Confirm the buy…" });
    try {
      await ensureChain(p);
      const value = "0x" + parseEther(buyEth.trim()).toString(16);
      const hash = await p.request({ method: "eth_sendTransaction", params: [{ from: account, to: SIGNA_PUMP_ADDRESS, data: buildBuyCalldata(token, 0n), value }] });
      setStatus({ k: "ok", t: `Bought ✓ ${hash.slice(0, 12)}…` }); setBuyEth("");
      setTimeout(() => { load(); readBal(account); }, 3500);
    } catch (e: any) { setStatus({ k: "err", t: /reject|denied/i.test(e?.message || "") ? "Rejected." : "Buy failed (need ETH for the trade + gas)." }); }
    setBusy(false);
  }
  async function sell() {
    const p = provider(); if (!p || !account) return connect();
    if (!/^\d*\.?\d+$/.test(sellTok.trim())) { setStatus({ k: "err", t: "Enter a token amount." }); return; }
    setBusy(true);
    try {
      await ensureChain(p);
      const amt = parseEther(sellTok.trim());
      setStatus({ k: "info", t: "1/2 approve the token…" });
      await p.request({ method: "eth_sendTransaction", params: [{ from: account, to: token, data: buildApproveCalldata(SIGNA_PUMP_ADDRESS, amt) }] });
      setStatus({ k: "info", t: "2/2 confirm the sell…" });
      const hash = await p.request({ method: "eth_sendTransaction", params: [{ from: account, to: SIGNA_PUMP_ADDRESS, data: buildSellCalldata(token, amt, 0n) }] });
      setStatus({ k: "ok", t: `Sold ✓ ${hash.slice(0, 12)}…` }); setSellTok("");
      setTimeout(() => { load(); readBal(account); }, 3500);
    } catch (e: any) { setStatus({ k: "err", t: /reject|denied/i.test(e?.message || "") ? "Rejected." : "Sell failed." }); }
    setBusy(false);
  }

  const m = d?.meta, c = d?.chain;
  const raised = c ? Number(formatEther(BigInt(c.raised))) : 0;
  const threshold = c ? Number(formatEther(BigInt(c.threshold))) : 3;
  const pct = Math.min(100, threshold ? (raised / threshold) * 100 : 0);

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <PumpNotifications />
      <div className="max-w-[720px] mx-auto px-5 py-10 sm:py-14">
        <a href="/pump" className="text-[13px] text-[#a98bff]">← all coins</a>
        <div className="mt-3 flex items-center gap-3">
          <div className="size-14 rounded-xl overflow-hidden bg-gradient-to-br from-[#7c3aed] to-[#3b6fe0] flex items-center justify-center text-[20px] font-bold text-white shrink-0">
            {m?.image_url ? <img src={m.image_url} alt="" className="w-full h-full object-cover" /> : (m?.symbol?.[0] || "?")}
          </div>
          <div className="min-w-0">
            <div className="text-[22px] font-bold truncate">{m?.name || short(token)} {m?.symbol && <span className="text-faint font-normal">${m.symbol}</span>}</div>
            <div className="text-[11px] text-faint font-mono truncate">{short(token)} · by {short(m?.creator)}</div>
          </div>
          <div className="ml-auto flex gap-2 text-[12px]">
            {m?.twitter && <a href={m.twitter} target="_blank" rel="noreferrer" className="text-[#c4b4ff] underline">X</a>}
            {m?.telegram && <a href={m.telegram} target="_blank" rel="noreferrer" className="text-[#c4b4ff] underline">TG</a>}
            {m?.website && <a href={m.website} target="_blank" rel="noreferrer" className="text-[#c4b4ff] underline">site</a>}
          </div>
        </div>
        {m?.description && <p className="text-[13px] text-muted mt-2">{m.description}</p>}

        {/* chart */}
        <div className="mt-5 glass rounded-2xl p-3 border border-white/[0.07]">
          <Candles trades={d?.trades ?? []} />
        </div>

        {/* progress */}
        <div className="mt-4 glass rounded-xl p-4 border border-white/[0.07]">
          <div className="flex justify-between text-[12px] mb-1.5">
            <span className="text-faint">{c?.graduated ? "graduated to Uniswap 🎓" : "bonding curve → graduation"}</span>
            <span className="text-white">{raised.toFixed(3)} / {threshold} ETH</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-gradient-to-r from-[#7c3aed] to-[#3b6fe0]" style={{ width: `${pct}%` }} /></div>
        </div>

        {/* trade */}
        {!c?.graduated && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="glass rounded-xl p-4 border border-[#5ee68f]/20">
              <div className="text-[13px] font-semibold text-[#5ee68f] mb-2">Buy</div>
              <input value={buyEth} onChange={(e) => setBuyEth(e.target.value.replace(/[^\d.]/g, ""))} placeholder="ETH amount" inputMode="decimal" className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-[#5ee68f]/50" />
              <button onClick={buy} disabled={busy || !pumpLive} className="w-full mt-2 px-4 py-2.5 rounded-lg text-[14px] font-semibold bg-[#22c98a]/20 text-[#5ee68f] hover:bg-[#22c98a]/30 disabled:opacity-60">{account ? "Buy" : "Connect"}</button>
            </div>
            <div className="glass rounded-xl p-4 border border-red-400/20">
              <div className="text-[13px] font-semibold text-red-300 mb-2">Sell {account && <span className="text-faint font-normal">· bal {Number(formatEther(BigInt(bal))).toLocaleString()}</span>}</div>
              <input value={sellTok} onChange={(e) => setSellTok(e.target.value.replace(/[^\d.]/g, ""))} placeholder="token amount" inputMode="decimal" className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-red-400/50" />
              <button onClick={sell} disabled={busy || !pumpLive} className="w-full mt-2 px-4 py-2.5 rounded-lg text-[14px] font-semibold bg-red-500/15 text-red-300 hover:bg-red-500/25 disabled:opacity-60">{account ? "Sell (approve + sell)" : "Connect"}</button>
            </div>
          </div>
        )}
        {status && <div className={`mt-3 text-[13px] rounded-lg px-3 py-2.5 break-words ${status.k === "ok" ? "bg-[#22c98a]/10 text-[#bdf5d2] border border-[#5ee68f]/30" : status.k === "err" ? "bg-red-500/10 text-red-300 border border-red-500/30" : "bg-white/[0.05] text-faint"}`}>{status.t}</div>}

        {/* trades */}
        <div className="mt-6">
          <div className="text-[12px] uppercase tracking-[0.18em] text-faint font-semibold">{(d?.trades ?? []).length} trades</div>
          <div className="mt-2 flex flex-col gap-1">
            {[...(d?.trades ?? [])].reverse().slice(0, 30).map((t, i) => (
              <div key={t.tx + i} className="flex items-center gap-2 text-[12px] font-mono glass rounded-lg px-3 py-1.5 border border-white/[0.05]">
                <span className={t.isBuy ? "text-[#5ee68f]" : "text-red-300"}>{t.isBuy ? "buy" : "sell"}</span>
                <span className="text-faint">{Number(formatEther(BigInt(t.eth))).toFixed(4)} ETH</span>
                {RH_EXPLORER && <a href={`${RH_EXPLORER}/tx/${t.tx}`} target="_blank" rel="noreferrer" className="ml-auto text-[#5ee68f] underline">↗</a>}
              </div>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-faint mt-8">⚠️ Bonding curve on the SignaPump contract (Robinhood Chain) — custodial + testnet pending audit. 2% fee (1% creator / 1% platform); graduates to Uniswap at {threshold} ETH → DexScreener. Not affiliated with Robinhood.</p>
      </div>
    </div>
  );
}
