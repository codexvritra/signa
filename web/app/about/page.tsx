"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ShieldCheck,
  Network,
  Cpu,
  Server,
  Code2,
  Github,
} from "lucide-react";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";

const stack = [
  {
    icon: ShieldCheck,
    title: "XMTP V3 (MLS)",
    desc: "Messaging Layer Security. End-to-end encrypted, decentralized, wallet-native. No servers store your messages in plaintext.",
  },
  {
    icon: Network,
    title: "Base Sepolia",
    desc: "Coinbase's L2 testnet. The web app prompts wallets to switch to it; XMTP itself runs on its own network independent of any chain.",
  },
  {
    icon: Cpu,
    title: "Groq + Llama 3.3 70B",
    desc: "Free tier inference at ~500 tokens/sec. Agents call Groq for replies and use tool-calling to read on-chain data via viem.",
  },
  {
    icon: Server,
    title: "Next.js + Railway",
    desc: "Web is a Next.js 15 app on Vercel. Agents are Node services on Railway with @xmtp/agent-sdk and a mounted volume for the local XMTP DB.",
  },
];

const facts = [
  ["Messages", "End-to-end encrypted via MLS"],
  ["Identity", "Derived from your wallet signature"],
  ["History", "Stored locally + on XMTP nodes (encrypted)"],
  ["Agent reads", "viem getBalance / getTransactionCount on Base Sepolia"],
  ["Agent model", "llama-3.3-70b-versatile (configurable)"],
  ["License", "MIT"],
];

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 flex flex-col items-center px-4 sm:px-6 py-8 sm:py-12">
        <div className="w-full max-w-3xl flex flex-col gap-8">
          <Link
            href="/"
            className="text-xs text-white/50 hover:text-white flex items-center gap-1 self-start"
          >
            <ArrowLeft className="size-3" />
            Back
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2 text-white/60 text-xs uppercase tracking-wider">
              <Code2 className="size-3.5" />
              About
            </div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              An open agent messaging stack
            </h1>
            <p className="text-white/55 max-w-xl leading-relaxed">
              Agent Messenger is a small, open-source app built to demonstrate
              what wallet-native messaging looks like when you wire it directly
              to LLM agents. Nothing here is gated, custodial, or paywalled.
              Fork it, run it, fill it with your own agents.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.06 } },
            }}
            className="grid sm:grid-cols-2 gap-3"
          >
            {stack.map(({ icon: Icon, title, desc }) => (
              <motion.div
                key={title}
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  show: { opacity: 1, y: 0 },
                }}
                className="glass rounded-2xl p-5 flex flex-col gap-2"
              >
                <Icon className="size-4 text-white/70" />
                <div className="text-sm font-medium text-white">{title}</div>
                <div className="text-xs text-white/50 leading-relaxed">{desc}</div>
              </motion.div>
            ))}
          </motion.div>

          <div className="glass rounded-2xl p-5">
            <div className="text-xs uppercase tracking-wider text-white/40 mb-3">
              Quick facts
            </div>
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {facts.map(([k, v]) => (
                <div
                  key={k}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-3"
                >
                  <dt className="text-white/45 text-xs">{k}</dt>
                  <dd className="text-white/85">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="text-center pt-2">
            <a
              href="https://github.com/sishirupretii/agent-messenger"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-white text-black font-medium rounded-xl px-4 py-2.5 text-sm hover:bg-white/90 transition-colors"
            >
              <Github className="size-4" />
              View on GitHub
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
