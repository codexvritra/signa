import type { Metadata } from "next";
import { AutonomyDemo } from "./AutonomyDemo";
import { BrainSpendDemo } from "./BrainSpendDemo";
import { SITE } from "@/lib/miniapp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agent budgets — let an agent spend, safely, on Base",
  description:
    "Agentic payments stalled because no one can safely fund an agent. SIGNA fixes the rail: a wallet-signed budget, a way for the agent to ask for more, and a verifiable record of every spend.",
  openGraph: {
    title: "Give an agent a budget it can't blow — on Base",
    description: "Signed spend mandates, agent budget requests, verifiable spend ledger. The rail under agentic commerce.",
    url: `${SITE}/autonomy`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Give an agent a budget it can't blow — on Base",
    description: "Signed spend mandates, agent budget requests, verifiable spend ledger.",
  },
};

const STEPS = [
  { k: "1", t: "Grant", d: "A human wallet-signs a budget: this agent may spend up to $X, max $Y per buy, until [date].", c: "#8b5cf6" },
  { k: "2", t: "Spend", d: "The agent buys within bounds — every spend signed + checked against the mandate.", c: "#5b8def" },
  { k: "3", t: "Ask", d: "Out of budget? The agent wallet-signs a request for more — the primitive that was missing.", c: "#5b8def" },
  { k: "4", t: "Audit", d: "The human sees every dollar, why, and that it stayed in bounds — re-verifiable on Base.", c: "#8b5cf6" },
];

export default function AutonomyPage() {
  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-[820px] mx-auto px-5 py-10 sm:py-14">
        <div className="text-[12px] uppercase tracking-[0.18em] text-faint">agent budgets · on Base</div>
        <h1 className="font-display text-[32px] sm:text-[44px] leading-[1.05] font-bold mt-3 tracking-tight">
          Give an agent money <span className="brand-text">it can’t blow.</span>
        </h1>
        <p className="text-muted text-[16px] sm:text-[17px] mt-4 leading-relaxed max-w-[680px]">
          Agentic payments stalled — the chart spiked and crashed — and the builders are right about
          why: no agent has ever <em>asked you for money</em>, and you'd never hand one your wallet
          anyway. The missing piece isn't the payment rail. It's a safe way to say yes.
        </p>
        <p className="text-muted text-[16px] mt-3 leading-relaxed max-w-[680px]">
          SIGNA is that rail: a <b>wallet-signed budget</b> an agent can't exceed, a way for it to{" "}
          <b>ask for more</b>, and a <b>verifiable record</b> of every spend. We can't make an agent{" "}
          <em>want</em> to buy — but the day it does, this is how you let it.
        </p>

        <div className="grid sm:grid-cols-4 gap-3 mt-9">
          {STEPS.map((s) => (
            <div key={s.k} className="glass rounded-xl p-4">
              <div className="size-7 rounded-lg flex items-center justify-center text-[13px] font-bold text-white mb-2.5" style={{ background: s.c }}>
                {s.k}
              </div>
              <div className="text-[14px] font-semibold">{s.t}</div>
              <div className="text-[12px] text-muted mt-1 leading-relaxed">{s.d}</div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-4">
          <div className="text-[12px] uppercase tracking-[0.16em] text-faint">an agent buys within a budget</div>
          <AutonomyDemo />
          <div className="text-[12px] uppercase tracking-[0.16em] text-faint mt-4">a brain pays for its own thinking</div>
          <BrainSpendDemo />
        </div>

        <div className="mt-10 pt-6 border-t border-white/[0.06] text-[12px] text-faint leading-relaxed">
          Honest scope: the mandate is a wallet-signed authorization, not on-chain custody — SIGNA
          never holds funds. It binds intent, bounds, and a re-verifiable spend ledger so a human can
          safely delegate a budget. Settlement of each purchase is the permissionless x402 step.
        </div>
      </div>
    </div>
  );
}
