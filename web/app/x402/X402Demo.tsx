"use client";

import { useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const short = (a: string) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);
const usdc = (raw: string) => {
  try {
    return `${(Number(BigInt(raw)) / 1e6).toFixed(2)} USDC`;
  } catch {
    return `${raw}`;
  }
};

export function X402Demo() {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [receipt, setReceipt] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setState("running");
    setErr(null);
    try {
      const res = await fetch("/api/x402/demo", { method: "POST" });
      const j = await res.json();
      if (!res.ok || !j?.ok) {
        setErr(j?.error ?? "demo_failed");
        setState("error");
        return;
      }
      setReceipt(j.receipt);
      setState("done");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setState("error");
    }
  }

  return (
    <div className="glass-strong rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[15px] font-semibold">Run a live receipt</div>
          <div className="text-[13px] text-muted mt-0.5">
            Generates a real EIP-3009 USDC authorization on Base, then issues a signed receipt for it.
            Nothing is broadcast — no funds move.
          </div>
        </div>
        <button
          onClick={run}
          disabled={state === "running"}
          className="h-11 px-5 rounded-xl font-semibold text-white text-[14px] bg-gradient-to-br from-[#5b8def] to-[#8b5cf6] disabled:opacity-50 shrink-0"
        >
          {state === "running" ? "Running…" : state === "done" ? "Run again" : "Run it live"}
        </button>
      </div>

      {state === "error" && <div className="mt-4 text-[13px] text-[var(--error)]">error: {err}</div>}

      {state === "done" && receipt && (
        <div className="mt-5 grid sm:grid-cols-2 gap-3">
          <Part label="1 · request" tone="blue">
            <div className="text-[13px]">{receipt.request?.item ?? "agent purchase"}</div>
            <div className="mt-1 text-[11px] text-faint font-mono">buyer {short(receipt.buyer)}</div>
          </Part>
          <Part label="2 · terms" tone="violet">
            <div className="text-[13px]">{usdc(receipt.amount)} on Base</div>
            <div className="mt-1 text-[11px] text-faint font-mono">to {short(receipt.seller)}</div>
          </Part>
          <Part label="3 · x402 payment" tone="blue">
            <div className="text-[13px]">EIP-3009 authorization ✓ valid</div>
            <div className="mt-1 text-[11px] text-faint font-mono break-all">
              sig {short(receipt.payment?.signature ?? "")}
            </div>
          </Part>
          <Part label="4 · delivery" tone="violet">
            <div className="text-[13px]">{receipt.output?.delivered ? "delivered ✓" : "—"}</div>
            <div className="mt-1 text-[11px] text-faint font-mono">hash {short(receipt.delivery_hash)}</div>
          </Part>

          <div className="sm:col-span-2 mt-1 rounded-xl border border-[rgba(91,141,239,0.4)] bg-[rgba(91,141,239,0.07)] p-4">
            <div className="text-[14px] font-semibold text-[#a5c3ff]">
              ✓ receipt issued — all four bound + signed by the SIGNA attestor
            </div>
            <div className="mt-1.5 text-[12px] text-muted font-mono break-all">
              signer {short(receipt.signer)} · sig {short(receipt.signature)}
            </div>
            <a
              href={`/x402/${receipt.id}`}
              className="mt-3 inline-flex h-10 px-4 items-center rounded-lg font-medium text-[13px] text-white bg-white/[0.06] hover:bg-white/[0.1] border border-white/10"
            >
              Open the receipt + re-verify →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function Part({
  label,
  tone,
  children,
}: {
  label: string;
  tone: "blue" | "violet";
  children: React.ReactNode;
}) {
  return (
    <div className="glass rounded-xl p-3.5">
      <div
        className="text-[10px] uppercase tracking-[0.16em] mb-1.5"
        style={{ color: tone === "blue" ? "#5b8def" : "#8b5cf6" }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}
