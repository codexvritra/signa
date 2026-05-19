"use client";

import { useEffect, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { toast } from "sonner";
import { ArrowUpRight, Eye, EyeOff } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { buildMessageToSign } from "@/lib/feed-types";

/**
 * Bankr connect/disconnect + real /trade execution.
 *
 * - Connect: paste your `bk_…` Bankr Agent API key, sign an attestation,
 *   SIGNA encrypts + stores it server-side. Trade button + slash-command
 *   in chat go live.
 * - Trade: type a natural-language order ("buy 100 USDC of MIROSHARK").
 *   SIGNA forwards to Bankr /agent/prompt, polls the job, renders the
 *   result inline with the tx hash + amounts.
 * - Disconnect: signed purge; encrypted blob deleted from the DB.
 *
 * Renders nothing when viewing someone else's /me (placeholder for the
 * eventual public-profile case).
 */
export function BankrConnect({ address }: { address: string }) {
  const { address: connectedAddress } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [connected, setConnected] = useState(false);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [lastUsed, setLastUsed] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [keyInput, setKeyInput] = useState("");
  const [reveal, setReveal] = useState(false);
  const [showKeyField, setShowKeyField] = useState(false);

  const [prompt, setPrompt] = useState("");
  const [tradeResult, setTradeResult] = useState<TradeResult | null>(null);
  const [tradeBusy, setTradeBusy] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);

  const isOwner =
    !!connectedAddress &&
    connectedAddress.toLowerCase() === address.toLowerCase();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/me/bankr-key?address=${address.toLowerCase()}`,
          { cache: "no-store" },
        );
        const j = await res.json();
        if (cancelled) return;
        setConnected(!!j.connected);
        setConnectedAt(j.connected_at ?? null);
        setLastUsed(j.last_used_at ?? null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [address]);

  async function connect() {
    if (busy || !isOwner) return;
    const apiKey = keyInput.trim();
    if (!/^bk_[A-Za-z0-9_-]{20,}$/.test(apiKey)) {
      toast.error("Bankr API key must start with bk_ and be ≥24 chars");
      return;
    }
    setBusy(true);
    try {
      const ts = Date.now();
      const message = buildMessageToSign({
        kind: "bankr_connect",
        address: address.toLowerCase(),
        connect: true,
        ts,
      });
      const signature = await signMessageAsync({ message });
      const res = await fetch("/api/me/bankr-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          address: address.toLowerCase(),
          connect: true,
          api_key: apiKey,
          ts,
          signature,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        throw new Error(j.message || j.error || "connect failed");
      }
      setConnected(true);
      setConnectedAt(new Date().toISOString());
      setKeyInput("");
      setShowKeyField(false);
      toast.success("Bankr connected — /trade now live in any chat");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (busy || !isOwner) return;
    if (!confirm("Disconnect Bankr? Your encrypted key will be purged.")) return;
    setBusy(true);
    try {
      const ts = Date.now();
      const message = buildMessageToSign({
        kind: "bankr_connect",
        address: address.toLowerCase(),
        connect: false,
        ts,
      });
      const signature = await signMessageAsync({ message });
      const res = await fetch("/api/me/bankr-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          address: address.toLowerCase(),
          connect: false,
          ts,
          signature,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "disconnect failed");
      setConnected(false);
      setConnectedAt(null);
      setLastUsed(null);
      setTradeResult(null);
      toast.success("Bankr disconnected, key purged");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function executeTrade() {
    if (tradeBusy || !isOwner) return;
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setTradeBusy(true);
    setTradeError(null);
    setTradeResult(null);
    try {
      const ts = Date.now();
      // Sign over the exact prompt so a stolen request can't be
      // replayed against a different one
      const message = [
        `SIGNA trade v1`,
        `ts:${ts}`,
        `address:${address.toLowerCase()}`,
        `prompt:${trimmed}`,
      ].join("\n");
      const signature = await signMessageAsync({ message });
      const res = await fetch("/api/me/trade", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          address: address.toLowerCase(),
          prompt: trimmed,
          ts,
          signature,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        throw new Error(j.message || j.error || "trade failed");
      }
      setTradeResult(j as TradeResult);
      setLastUsed(new Date().toISOString());
      if (j.status === "completed") {
        toast.success("Trade executed via Bankr");
      } else {
        toast.message(`Trade status: ${j.status ?? "unknown"}`);
      }
    } catch (e) {
      setTradeError(e instanceof Error ? e.message : String(e));
    } finally {
      setTradeBusy(false);
    }
  }

  if (!isOwner) return null;
  if (loading) {
    return (
      <section className="border-b border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-6 lg:px-10 py-8">
          <div className="font-mono text-[11px] text-[var(--accent)] mb-3">
            $ signa bankr --status
          </div>
          <Spinner size={16} className="text-white/60" />
        </div>
      </section>
    );
  }

  return (
    <section className="border-b border-white/[0.06]">
      <div className="max-w-4xl mx-auto px-6 lg:px-10 py-8">
        <div className="font-mono text-[11px] text-[var(--accent)] mb-3">
          $ signa bankr {connected ? "--connected" : "--connect"}
        </div>

        <div className="border border-white/10 bg-black/30 p-4">
          {!connected && !showKeyField && (
            <div className="flex flex-wrap items-start gap-4 justify-between">
              <div className="min-w-0 flex-1">
                <div className="font-display text-[16px] text-white font-medium">
                  Connect your Bankr account
                </div>
                <p className="text-[12px] text-white/55 mt-1.5 leading-relaxed max-w-md">
                  Paste your Bankr Agent API key once. SIGNA encrypts it with
                  AES-256-GCM server-side. Then{" "}
                  <code className="font-mono text-white/75 bg-white/[0.04] px-1 rounded">
                    /trade buy 100 USDC of MIROSHARK
                  </code>{" "}
                  in any chat executes through Bankr against your wallet.
                </p>
                <a
                  href="https://docs.bankr.bot/agent-api/overview"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-[var(--accent)] hover:brightness-125 mt-2 font-mono underline underline-offset-4"
                >
                  get your bk_ key
                  <ArrowUpRight className="size-3" />
                </a>
              </div>
              <button
                onClick={() => setShowKeyField(true)}
                className="bg-[var(--accent)] text-black font-semibold text-[12px] uppercase tracking-wide rounded-md px-3 py-1.5 hover:brightness-110 transition"
              >
                $ connect
              </button>
            </div>
          )}

          {!connected && showKeyField && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/45 mb-1.5 block font-mono">
                Bankr Agent API key
              </label>
              <div className="relative">
                <input
                  type={reveal ? "text" : "password"}
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="bk_…"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-md bg-white/[0.04] border border-white/10 px-3 py-2.5 pr-20 text-[13px] font-mono text-white outline-none focus:border-white/25 transition-colors"
                />
                <button
                  onClick={() => setReveal((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-white/55 hover:text-white px-2 py-1 rounded-sm inline-flex items-center gap-1"
                  type="button"
                >
                  {reveal ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                  {reveal ? "hide" : "reveal"}
                </button>
              </div>
              <p className="text-[11px] text-white/35 mt-1.5">
                SIGNA verifies this key by calling Bankr&apos;s /wallet/me
                before storing. Bad keys are rejected without persisting.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={connect}
                  disabled={busy || !keyInput.trim()}
                  className="bg-[var(--accent)] text-black font-semibold text-[12px] uppercase tracking-wide rounded-md px-3 py-1.5 disabled:opacity-50 hover:brightness-110 transition inline-flex items-center gap-1.5"
                >
                  {busy && <Spinner size={10} className="text-black" />}
                  {busy ? "Verifying…" : "Encrypt + connect"}
                </button>
                <button
                  onClick={() => {
                    setShowKeyField(false);
                    setKeyInput("");
                  }}
                  disabled={busy}
                  className="text-[12px] text-white/55 hover:text-white px-2 py-1.5"
                >
                  cancel
                </button>
              </div>
            </div>
          )}

          {connected && (
            <>
              <div className="flex flex-wrap items-start gap-4 justify-between">
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[16px] text-white font-medium">
                    Bankr connected ✓
                  </div>
                  <p className="text-[12px] text-white/55 mt-1.5 leading-relaxed">
                    /trade routes through your Bankr key. Try a small order
                    below to test, or use{" "}
                    <code className="font-mono text-white/75 bg-white/[0.04] px-1 rounded">
                      /trade …
                    </code>{" "}
                    in any chat composer.
                  </p>
                  <div className="text-[10px] font-mono text-white/35 mt-2 space-x-2">
                    {connectedAt && (
                      <span>connected: {connectedAt.slice(0, 16).replace("T", " ")}</span>
                    )}
                    {lastUsed && (
                      <>
                        <span>·</span>
                        <span>last trade: {lastUsed.slice(0, 16).replace("T", " ")}</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={disconnect}
                  disabled={busy}
                  className="border border-rose-400/30 text-rose-300 text-[12px] font-mono rounded-md px-3 py-1.5 hover:bg-rose-400/[0.05] transition disabled:opacity-50"
                >
                  $ disconnect
                </button>
              </div>

              <div className="mt-5 pt-4 border-t border-white/[0.06]">
                <label className="text-[10px] uppercase tracking-wider text-white/45 mb-1.5 block font-mono">
                  /trade prompt (natural language)
                </label>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void executeTrade();
                    }}
                    placeholder="buy 1 USDC of MIROSHARK"
                    className="flex-1 min-w-[280px] rounded-md bg-white/[0.04] border border-white/10 px-3 py-2 text-[13px] font-mono text-white outline-none focus:border-white/25 transition-colors"
                  />
                  <button
                    onClick={executeTrade}
                    disabled={tradeBusy || !prompt.trim()}
                    className="bg-[var(--accent)] text-black font-semibold text-[12px] uppercase tracking-wide rounded-md px-4 py-2 disabled:opacity-50 hover:brightness-110 transition inline-flex items-center gap-1.5"
                  >
                    {tradeBusy && <Spinner size={10} className="text-black" />}
                    {tradeBusy ? "Trading…" : "Execute"}
                    {!tradeBusy && (
                      <span aria-hidden className="font-mono">
                        →
                      </span>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-white/35 mt-1.5">
                  Goes to <code className="font-mono">api.bankr.bot/agent/prompt</code>{" "}
                  with your key, polled up to 30s. Bankr executes against your
                  Bankr-managed wallet — SIGNA never holds funds.
                </p>

                {tradeError && (
                  <div className="mt-3 border border-rose-400/30 bg-rose-400/[0.04] px-3 py-2 text-[12px] text-rose-200 font-mono">
                    {tradeError}
                  </div>
                )}
                {tradeResult && tradeResult.status === "completed" && (
                  <div className="mt-3 border border-emerald-300/30 bg-emerald-300/[0.04] px-3 py-2.5 text-[12px] text-emerald-100 font-mono">
                    <div className="font-display text-[14px] text-emerald-200 mb-1">
                      ✓ trade executed
                    </div>
                    {tradeResult.tokenSymbol && (
                      <div>
                        {tradeResult.amountIn} → {tradeResult.amountOut} $
                        {tradeResult.tokenSymbol}
                      </div>
                    )}
                    {tradeResult.transactionHash && (
                      <a
                        href={`https://basescan.org/tx/${tradeResult.transactionHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-300 underline underline-offset-4 hover:brightness-125 inline-flex items-center gap-1 mt-1"
                      >
                        view on BaseScan
                        <ArrowUpRight className="size-3" />
                      </a>
                    )}
                  </div>
                )}
                {tradeResult && tradeResult.status !== "completed" && (
                  <div className="mt-3 border border-amber-300/30 bg-amber-300/[0.04] px-3 py-2 text-[12px] text-amber-100 font-mono">
                    Bankr returned status: {tradeResult.status ?? "unknown"}.
                    Job {tradeResult.job_id ?? "?"} may still be processing —
                    check Bankr&apos;s dashboard.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

type TradeResult = {
  ok?: boolean;
  status?: string;
  job_id?: string;
  transactionHash?: string | null;
  tokenSymbol?: string | null;
  tokenAddress?: string | null;
  amountIn?: string | null;
  amountOut?: string | null;
};
