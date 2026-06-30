"use client";

import { useEffect, useState, useCallback } from "react";
import { useAccount, useSendTransaction } from "wagmi";
import { parseEther } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { buildPaidSendCalldata, buildSetPriceCalldata, SIGNA_PAID_ADDRESS } from "@/lib/signa-paid";

/**
 * /pay — pay-to-reach inboxes, settled on Base in the same tx.
 * Set a price → share your "pay to reach me" link. Or /pay?to=0x… to pay + message.
 */
type Paid = { id: string; from: string; to: string; value_eth: string; body: string; timestamp: number; tx: string };
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export default function PayPage() {
  const { address, isConnected } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const me = address?.toLowerCase() ?? "";

  const [to, setTo] = useState<string>("");          // recipient (resolved 0x) when in pay mode
  const [toRaw, setToRaw] = useState<string>("");     // ?to= as given
  const [toPrice, setToPrice] = useState<string>(""); // recipient price in ETH
  const [body, setBody] = useState("");
  const [myPrice, setMyPrice] = useState<string>("0");
  const [priceInput, setPriceInput] = useState("");
  const [inbox, setInbox] = useState<Paid[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ k: "ok" | "err" | "info"; t: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // read ?to= from the URL → resolve → fetch their price (pay mode)
  useEffect(() => {
    let id = "";
    try { id = new URLSearchParams(window.location.search).get("to") ?? ""; } catch {}
    if (!id) return;
    setToRaw(id);
    (async () => {
      let addr = id;
      if (!/^0x[0-9a-fA-F]{40}$/.test(id)) {
        try { const r = await (await fetch(`/api/resolve?id=${encodeURIComponent(id)}`)).json(); if (r.ok && r.address) addr = r.address; } catch {}
      }
      addr = addr.toLowerCase();
      setTo(addr);
      try { const p = await (await fetch(`/api/paid-message?price=${addr}`)).json(); if (p.ok) setToPrice(p.price_eth); } catch {}
    })();
  }, []);

  const loadMine = useCallback(async () => {
    if (!me) return;
    try { const p = await (await fetch(`/api/paid-message?price=${me}`, { cache: "no-store" })).json(); if (p.ok) setMyPrice(p.price_eth); } catch {}
    try { const j = await (await fetch(`/api/paid-message?inbox=${me}`, { cache: "no-store" })).json(); if (j.ok) setInbox(j.messages ?? []); } catch {}
  }, [me]);
  useEffect(() => { loadMine(); const t = setInterval(loadMine, 15000); return () => clearInterval(t); }, [loadMine]);

  async function setPrice() {
    const v = priceInput.trim();
    if (!/^\d*\.?\d+$/.test(v)) { setStatus({ k: "err", t: "Enter an ETH amount, e.g. 0.001" }); return; }
    setBusy(true); setStatus({ k: "info", t: "Confirm the tx to set your price…" });
    try {
      const data = buildSetPriceCalldata(parseEther(v));
      await sendTransactionAsync({ to: SIGNA_PAID_ADDRESS as `0x${string}`, data, value: 0n });
      setStatus({ k: "ok", t: `Price set to ${v} ETH. Share your link below.` });
      setMyPrice(v); setPriceInput("");
    } catch (e) {
      setStatus({ k: "err", t: e instanceof Error && /reject|denied/i.test(e.message) ? "Rejected." : "Couldn't set price (need a little Base ETH for gas)." });
    }
    setBusy(false);
  }

  async function payAndSend() {
    if (!/^0x[0-9a-f]{40}$/.test(to)) { setStatus({ k: "err", t: "No valid recipient." }); return; }
    const text = body.trim();
    if (!text) { setStatus({ k: "err", t: "Type a message." }); return; }
    setBusy(true); setStatus({ k: "info", t: "Confirm the payment + message…" });
    try {
      const data = buildPaidSendCalldata(to, text);
      const value = parseEther(toPrice || "0");
      const hash = await sendTransactionAsync({ to: SIGNA_PAID_ADDRESS as `0x${string}`, data, value });
      setStatus({ k: "ok", t: `Sent + paid ${toPrice || "0"} ETH ✓ — basescan.org/tx/${hash.slice(0, 12)}…` });
      setBody("");
    } catch (e) {
      setStatus({ k: "err", t: e instanceof Error && /reject|denied/i.test(e.message) ? "Rejected." : "Couldn't send (need ETH for the price + gas)." });
    }
    setBusy(false);
  }

  const payMode = !!toRaw;
  const myLink = me ? `signaagent.xyz/pay?to=${me}` : "";

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-[560px] mx-auto px-5 py-12 sm:py-16">
        <div className="text-[12px] uppercase tracking-[0.2em] text-[#a98bff] font-semibold">Pay to reach · settled on Base</div>
        <h1 className="text-[32px] sm:text-[40px] font-bold leading-tight mt-1 tracking-tight">{payMode ? "Pay to reach this wallet." : "Charge to reach your inbox."}</h1>
        <p className="text-[15px] text-muted mt-2 leading-relaxed">
          A message with payment attached — the full amount settles to the recipient in the <span className="text-white">same Base transaction</span>, recorded on-chain. SIGNA holds nothing and takes no fee.
        </p>

        <div className="mt-5"><ConnectButton /></div>

        {/* PAY MODE */}
        {payMode && (
          <div className="mt-7 glass rounded-2xl p-5 border border-white/[0.07]">
            <div className="text-[13px] text-faint">To <span className="text-[#c4b4ff] font-mono">{short(to) || toRaw}</span></div>
            <div className="text-[15px] mt-1">Price to reach: <span className="text-[#5ee68f] font-semibold">{toPrice ? `${toPrice} ETH` : "free"}</span></div>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="your message…" className="w-full mt-3 bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-[#a98bff]/60 min-h-[90px]" />
            <button onClick={payAndSend} disabled={busy || !isConnected} className="w-full mt-3 px-4 py-3 rounded-xl text-[15px] font-semibold bg-gradient-to-r from-[#7c3aed] to-[#3b6fe0] text-white disabled:opacity-60 hover:brightness-110">
              {isConnected ? `Pay ${toPrice || "0"} ETH + send` : "Connect to send"}
            </button>
          </div>
        )}

        {/* OWNER MODE */}
        {!payMode && isConnected && (
          <div className="mt-7 glass rounded-2xl p-5 border border-white/[0.07]">
            <div className="text-[13px] text-faint">Your inbox price: <span className="text-white font-semibold">{myPrice} ETH</span></div>
            <div className="flex gap-2 mt-2">
              <input value={priceInput} onChange={(e) => setPriceInput(e.target.value)} placeholder="0.001" inputMode="decimal" className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-[#a98bff]/60" />
              <button onClick={setPrice} disabled={busy} className="px-4 py-2.5 rounded-lg text-[14px] font-semibold bg-white/[0.07] text-[#c4b4ff] hover:bg-white/[0.12] disabled:opacity-60">Set price (ETH)</button>
            </div>
            {myLink && (
              <div className="mt-3 flex items-center gap-2">
                <code className="text-[12px] text-[#c4b4ff] bg-black/30 rounded px-2 py-1.5 flex-1 truncate">{myLink}</code>
                <button onClick={() => { navigator.clipboard?.writeText(`https://${myLink}`); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="px-3 py-1.5 rounded text-[12px] font-semibold bg-white/[0.07] text-white hover:bg-white/[0.12]">{copied ? "copied" : "copy link"}</button>
              </div>
            )}
            <p className="text-[11px] text-faint mt-2">Share that link — anyone who opens it pays your price to message you, settled to your wallet on Base.</p>
          </div>
        )}

        {status && (
          <div className={`mt-4 text-[13px] rounded-lg px-3 py-2.5 break-words ${status.k === "ok" ? "bg-[#22c98a]/10 text-[#bdf5d2] border border-[#5ee68f]/30" : status.k === "err" ? "bg-red-500/10 text-red-300 border border-red-500/30" : "bg-white/[0.05] text-faint"}`}>{status.t}</div>
        )}

        {/* OWNER inbox */}
        {!payMode && isConnected && inbox.length > 0 && (
          <div className="mt-8">
            <div className="text-[12px] uppercase tracking-[0.18em] text-faint font-semibold">Your paid inbox</div>
            <div className="mt-3 flex flex-col gap-2">
              {inbox.map((m) => (
                <div key={m.tx + m.id} className="glass rounded-xl px-4 py-3 border border-white/[0.06]">
                  <div className="flex items-center gap-2 text-[12px] text-faint font-mono">
                    <span className="text-[#c4b4ff]">{short(m.from)}</span>
                    <span className="text-[#5ee68f]">paid {m.value_eth} ETH</span>
                    <a href={`https://basescan.org/tx/${m.tx}`} target="_blank" rel="noreferrer" className="ml-auto text-[#5ee68f] underline">⛓ ↗</a>
                  </div>
                  <div className="text-[14px] text-white/95 mt-1.5 break-words whitespace-pre-wrap">{m.body}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[11px] text-faint mt-10">
          Powered by the SignaPaidMessages contract on Base — the full payment is forwarded to the recipient in the same transaction; the contract holds no funds and charges no fee. signaagent.xyz/pay
        </p>
      </div>
    </div>
  );
}
