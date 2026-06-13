import type { Metadata } from "next";
import { EconomyLedger } from "./EconomyLedger";
import { SITE } from "@/lib/miniapp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The SIGNA economy — a live public ledger of agent spend",
  description:
    "Every budget a human granted an agent, every capped signed spend, every budget request, every x402 receipt — live and re-verifiable. The agent economy on Base, in the open. SIGNA never custodies funds.",
  openGraph: {
    title: "The SIGNA economy — agent spend, in the open",
    description: "Budgets, signed spends, budget requests, x402 receipts — a live, re-verifiable public ledger on Base.",
    url: `${SITE}/economy`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "The SIGNA economy — agent spend, in the open",
    description: "A live, re-verifiable public ledger of the agent economy on Base.",
  },
};

export default function EconomyPage() {
  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-[920px] mx-auto px-5 py-10 sm:py-14">
        <div className="text-[12px] uppercase tracking-[0.18em] text-faint">the agent economy · live · on Base</div>
        <h1 className="font-display text-[32px] sm:text-[46px] leading-[1.05] font-bold mt-3 tracking-tight">
          The economy, <span className="brand-text">in the open.</span>
        </h1>
        <p className="text-muted text-[16px] sm:text-[17px] mt-4 leading-relaxed max-w-[700px]">
          Everyone debates whether agents can really transact. Here&apos;s the ledger. Every budget a human
          granted an agent, every capped spend the agent signed, every time it asked for more, and every
          x402 receipt — live, and re-verifiable by anyone. No dashboard theater: each row is a wallet
          signature you can re-check.
        </p>

        <div className="mt-9">
          <EconomyLedger />
        </div>

        <div className="mt-10 grid sm:grid-cols-3 gap-3">
          <Card t="Granted, not given" d="A human wallet-signs a bounded budget. The agent can spend within hard caps — never the wallet itself." />
          <Card t="Every cent signed" d="Each spend is an EIP-191 signature on an append-only ledger, checked against per-tx + total caps server-side." />
          <Card t="Proven, not promised" d="Each x402 receipt binds request → terms → EIP-3009 payment → delivery. Re-verify any row at /api/verify." />
        </div>

        <div className="mt-9 pt-6 border-t border-white/[0.06] text-[12px] text-faint leading-relaxed">
          Honest scope: mandates and spends are wallet-signed authorizations, not on-chain custody — SIGNA
          never holds funds. Settlement of each purchase is the permissionless x402 step. This ledger counts
          real signed commerce activity on production; it is not a price or a market cap.
        </div>
      </div>
    </div>
  );
}

function Card({ t, d }: { t: string; d: string }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="text-[14px] font-semibold">{t}</div>
      <div className="text-[12px] text-muted mt-1 leading-relaxed">{d}</div>
    </div>
  );
}
