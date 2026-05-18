"use client";

import Link from "next/link";
import { ArrowLeft, Github } from "lucide-react";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";

const STACK: Array<{ k: string; v: string; hint?: string }> = [
  { k: "Transport", v: "XMTP V3 (MLS)", hint: "End-to-end encrypted, decentralized" },
  { k: "Wallet identity", v: "Base Sepolia", hint: "XMTP itself runs on its own network" },
  { k: "Web", v: "Next.js 15, React 19, Tailwind v4", hint: "RainbowKit + wagmi + viem" },
  { k: "Browser SDK", v: "@xmtp/browser-sdk v7", hint: "MLS-based" },
  { k: "Agent runtime", v: "Node.js + @xmtp/agent-sdk", hint: "Local SQLite, persisted via Railway volume" },
  { k: "LLM", v: "Llama 3.3 70B on Groq", hint: "Tool-calling against on-chain reads via viem" },
  { k: "Hosting", v: "Vercel (web) + Railway (agent)", hint: "Auto-deploys on push to main" },
  { k: "License", v: "MIT", hint: "Fork, change, run your own" },
];

const FACTS: Array<[string, string]> = [
  ["Messages", "Encrypted with MLS. Stored encrypted on XMTP nodes."],
  ["Identity", "Derived from a signature, not a password."],
  ["History", "Lives in your browser's IndexedDB + on XMTP nodes."],
  ["Agent reads", "viem.getBalance / getTransactionCount / getTransaction / ENS"],
  ["Agent model", "llama-3.3-70b-versatile (overridable per service)"],
  ["Memory", "Rebuilt from XMTP conversation history every reply"],
];

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1">
        <section className="border-b border-white/[0.06]">
          <div className="max-w-5xl mx-auto px-6 lg:px-10 pt-12 pb-16 sm:pt-16 sm:pb-20">
            <Link
              href="/"
              className="text-xs text-white/45 hover:text-white inline-flex items-center gap-1 mb-10"
            >
              <ArrowLeft className="size-3" />
              Back
            </Link>
            <div className="text-xs uppercase tracking-wider text-white/40 mb-3">
              About
            </div>
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-[-0.03em] leading-[1.05] max-w-2xl">
              A small, open stack for wallet-native messaging.
            </h1>
            <p className="text-white/55 max-w-xl mt-6 text-[16px] leading-relaxed">
              Agent Messenger is a working reference for what it looks like when
              you wire XMTP directly into LLM agents on a public testnet.
              Nothing's gated, custodial, or paywalled. Fork it, run your own
              agents, fill the directory.
            </p>
          </div>
        </section>

        <section className="border-b border-white/[0.06]">
          <div className="max-w-5xl mx-auto px-6 lg:px-10 py-16 sm:py-20">
            <div className="grid sm:grid-cols-[180px_1fr] gap-4 sm:gap-12">
              <div className="text-xs uppercase tracking-wider text-white/40">
                Stack
              </div>
              <div className="border-t border-white/[0.06]">
                {STACK.map((row) => (
                  <div
                    key={row.k}
                    className="grid grid-cols-[1fr_2fr] sm:grid-cols-[200px_1fr] gap-4 py-4 border-b border-white/[0.06]"
                  >
                    <div className="text-xs text-white/45 pt-0.5">{row.k}</div>
                    <div>
                      <div className="text-[15px] text-white">{row.v}</div>
                      {row.hint && (
                        <div className="text-xs text-white/40 mt-0.5">
                          {row.hint}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-white/[0.06]">
          <div className="max-w-5xl mx-auto px-6 lg:px-10 py-16 sm:py-20">
            <div className="grid sm:grid-cols-[180px_1fr] gap-4 sm:gap-12">
              <div className="text-xs uppercase tracking-wider text-white/40">
                Facts
              </div>
              <div className="space-y-4 max-w-2xl">
                {FACTS.map(([k, v]) => (
                  <div
                    key={k}
                    className="grid grid-cols-[1fr_2fr] sm:grid-cols-[200px_1fr] gap-4"
                  >
                    <div className="text-sm text-white/55">{k}</div>
                    <div className="text-sm text-white">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-white/[0.06]">
          <div className="max-w-5xl mx-auto px-6 lg:px-10 py-12 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-white/55">
              Read the source. Run an agent. Send a PR.
            </p>
            <a
              href="https://github.com/sishirupretii/agent-messenger"
              target="_blank"
              rel="noreferrer"
              className="bg-white text-black font-medium rounded-md px-4 py-2 text-sm hover:bg-white/90 transition-colors inline-flex items-center gap-1.5"
            >
              <Github className="size-3.5" />
              github.com/sishirupretii/agent-messenger
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
