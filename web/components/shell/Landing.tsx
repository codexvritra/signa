"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  MessageSquare,
  Bot,
  Lock,
  Wallet,
  PenLine,
  Send,
  ArrowRight,
  Github,
  Sparkles,
} from "lucide-react";
import { Footer } from "./Footer";

const features = [
  {
    icon: MessageSquare,
    title: "Wallet-to-wallet chat",
    desc: "End-to-end encrypted DMs and group chats between any two wallets via XMTP V3 (MLS).",
  },
  {
    icon: Bot,
    title: "Talk to agents",
    desc: "DM autonomous agents powered by Llama 3.3 70B that can read on-chain data and reply naturally.",
  },
  {
    icon: Lock,
    title: "Your wallet is your identity",
    desc: "No accounts, no passwords, no emails. Sign once with your wallet — your address is your handle.",
  },
];

const steps = [
  {
    icon: Wallet,
    title: "Connect your wallet",
    desc: "MetaMask, Coinbase, Rainbow, any WalletConnect wallet. Switch to Base Sepolia.",
  },
  {
    icon: PenLine,
    title: "Enable XMTP",
    desc: "Sign once to derive your XMTP identity. No gas. Takes ~10–30s the first time.",
  },
  {
    icon: Send,
    title: "Start messaging",
    desc: "Paste any wallet address to DM them, browse the agent directory, or create a group.",
  },
];

export function Landing() {
  return (
    <>
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 sm:py-16">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-2xl text-center flex flex-col items-center gap-6"
        >
          <a
            href="https://github.com/sishirupretii/agent-messenger"
            target="_blank"
            rel="noreferrer"
            className="glass rounded-full px-3 py-1 text-xs text-white/70 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <Github className="size-3" />
            Open source · MIT
            <ArrowRight className="size-3 opacity-50" />
          </a>
          <div className="relative">
            <div className="absolute inset-0 brand-gradient blur-3xl opacity-60 rounded-full" />
            <div className="relative size-16 sm:size-20 rounded-2xl brand-gradient shadow-2xl" />
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight leading-[1.05]">
              Talk to wallets.
              <br />
              Talk to <span className="brand-text">agents.</span>
            </h1>
            <p className="text-white/55 max-w-md mx-auto leading-relaxed text-base sm:text-lg">
              Open-source agent messaging on Base Sepolia. Connect a wallet to
              message any other wallet — or any agent — over XMTP.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <ConnectButton.Custom>
              {({ openConnectModal, mounted }) => (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={openConnectModal}
                  disabled={!mounted}
                  className="brand-gradient text-white font-medium rounded-xl px-6 py-3 shadow-lg disabled:opacity-50"
                >
                  Connect wallet
                </motion.button>
              )}
            </ConnectButton.Custom>
            <Link
              href="/directory"
              className="glass text-white font-medium rounded-xl px-5 py-3 hover:bg-white/[0.06] transition-colors flex items-center gap-2"
            >
              <Sparkles className="size-4" />
              Browse agents
            </Link>
          </div>
        </motion.div>

        {/* Features */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
          }}
          className="grid sm:grid-cols-3 gap-3 mt-16 w-full max-w-3xl"
        >
          {features.map(({ icon: Icon, title, desc }) => (
            <motion.div
              key={title}
              variants={{
                hidden: { opacity: 0, y: 12 },
                show: { opacity: 1, y: 0 },
              }}
              className="glass rounded-2xl p-5 flex flex-col gap-2"
            >
              <Icon className="size-4 text-white/70" />
              <div className="text-sm font-medium text-white">{title}</div>
              <div className="text-xs text-white/45 leading-relaxed">{desc}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* How it works */}
        <div className="w-full max-w-3xl mt-20 sm:mt-24">
          <div className="text-center mb-8">
            <div className="text-xs uppercase tracking-wider text-white/40 mb-2">
              How it works
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Three steps from cold wallet to chat
            </h2>
          </div>
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.08 } },
            }}
            className="grid sm:grid-cols-3 gap-3"
          >
            {steps.map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={title}
                variants={{
                  hidden: { opacity: 0, y: 12 },
                  show: { opacity: 1, y: 0 },
                }}
                className="glass rounded-2xl p-5 flex flex-col gap-2 relative"
              >
                <div className="flex items-center justify-between">
                  <div className="size-9 rounded-xl brand-gradient flex items-center justify-center">
                    <Icon className="size-4 text-white" />
                  </div>
                  <span className="text-2xl font-bold text-white/10">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="text-sm font-medium text-white mt-2">{title}</div>
                <div className="text-xs text-white/45 leading-relaxed">{desc}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* CTA strip */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-3xl mt-20 sm:mt-24 glass-strong rounded-2xl p-6 sm:p-8 text-center flex flex-col items-center gap-4"
        >
          <h3 className="text-xl sm:text-2xl font-semibold">
            Run your own agent
          </h3>
          <p className="text-sm text-white/55 max-w-md">
            Fork the repo, deploy to Railway, plug in your Groq key — your agent
            gets its own wallet address that anyone can DM.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <a
              href="https://github.com/sishirupretii/agent-messenger"
              target="_blank"
              rel="noreferrer"
              className="bg-white text-black font-medium rounded-xl px-4 py-2 hover:bg-white/90 transition-colors text-sm flex items-center gap-1.5"
            >
              <Github className="size-3.5" />
              View on GitHub
            </a>
            <Link
              href="/about"
              className="glass text-white font-medium rounded-xl px-4 py-2 hover:bg-white/[0.06] transition-colors text-sm"
            >
              How it works
            </Link>
          </div>
        </motion.div>
      </main>
      <Footer />
    </>
  );
}
