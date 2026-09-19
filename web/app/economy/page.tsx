import type { Metadata } from "next";
import { EconomyLedger } from "./EconomyLedger";
import { SITE } from "@/lib/miniapp";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";
import "@/app/marketing.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The SIGDA economy — a live public ledger of agent spend",
  description:
    "Every budget a human granted an agent, every capped signed spend, every budget request, every x402 receipt — live and re-verifiable. The agent economy on Robinhood Chain, in the open. SIGDA never custodies funds.",
  openGraph: {
    title: "The SIGDA economy — agent spend, in the open",
    description: "Budgets, signed spends, budget requests, x402 receipts — a live, re-verifiable public ledger on Robinhood Chain.",
    url: `${SITE}/economy`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "The SIGDA economy — agent spend, in the open",
    description: "A live, re-verifiable public ledger of the agent economy on Robinhood Chain.",
  },
};

export default function EconomyPage() {
  return (
    <div className="p min-h-screen flex flex-col">
      <AppHeader light />
      <main className="flex-1">
        <section className="hero" style={{ paddingBottom: 56 }}>
          <div className="shell" style={{ maxWidth: 920 }}>
            <span className="chip">The agent economy · live · on Robinhood Chain</span>
            <h1 style={{ fontSize: "clamp(32px, 5.5vw, 58px)" }}>
              The economy, <span className="mark">in the open.</span>
            </h1>
            <p className="sub" style={{ maxWidth: 700 }}>
              Everyone debates whether agents can really transact. Here&apos;s the ledger. Every budget a human
              granted an agent, every capped spend the agent signed, every time it asked for more, and every
              x402 receipt — live, and re-verifiable by anyone. No dashboard theater: each row is a wallet
              signature you can re-check.
            </p>

            <EconomyLedger />

            <div className="cards" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginTop: 40 }}>
              <Card t="Granted, not given" d="A human wallet-signs a bounded budget. The agent can spend within hard caps — never the wallet itself." />
              <Card t="Every cent signed" d="Each spend is an EIP-191 signature on an append-only ledger, checked against per-tx + total caps server-side." />
              <Card t="Proven, not promised" d="Each x402 receipt binds request → terms → EIP-3009 payment → delivery. Re-verify any row at /api/verify." />
            </div>

            <div style={{ marginTop: 36, paddingTop: 22, borderTop: "2px solid var(--ink)", fontSize: 12.5, lineHeight: 1.6, color: "var(--ink-soft)" }}>
              Honest scope: mandates and spends are wallet-signed authorizations, not on-chain custody — SIGDA
              never holds funds. Settlement of each purchase is the permissionless x402 step. This ledger counts
              real signed commerce activity on production; it is not a price or a market cap.
            </div>
          </div>
        </section>
      </main>
      <Footer light />
    </div>
  );
}

function Card({ t, d }: { t: string; d: string }) {
  return (
    <div className="card">
      <h3 style={{ fontSize: 16 }}>{t}</h3>
      <p style={{ marginBottom: 0 }}>{d}</p>
    </div>
  );
}
