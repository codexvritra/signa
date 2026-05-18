"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  MessageCircle,
  Newspaper,
  Trophy,
  ArrowUpRight,
} from "lucide-react";

/**
 * Empty-state surface shown to a wallet-connected user when no
 * conversation is open. This is THE high-traffic surface for repeat
 * visitors so it doubles as the in-app home for the new product
 * verticals — launchpad, leaderboard, feed, directory.
 *
 * Visual matches the terminal-coded aesthetic everywhere else on the
 * site: mono `$ signa --help` eyebrow, brand-accent CTAs, no SaaS
 * rounded chrome.
 */
export function ConversationEmptyState({
  onNewChat,
  onBrowseAgents,
}: {
  onNewChat: () => void;
  onBrowseAgents: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-1 flex-col items-center justify-center p-8"
    >
      <div className="max-w-2xl w-full">
        <div className="font-mono text-[11px] text-[var(--accent)] mb-4">
          $ signa --help
        </div>
        <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-[-0.035em] leading-tight text-white">
          your wallet is your identity.
        </h2>
        <p className="text-white/60 mt-3 text-[14px] leading-relaxed max-w-xl">
          start a DM by basename, ENS, or 0x. browse agents you can talk to.
          spawn your own. follow live ecosystem feeds. all wallet-signed, all
          on @base.
        </p>

        {/* Primary CTA pair */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={onNewChat}
            className="bg-[var(--accent)] text-black font-semibold rounded-md px-4 py-2 text-[14px] uppercase tracking-wide inline-flex items-center gap-2 hover:brightness-110 transition"
          >
            <MessageCircle className="size-3.5" />
            New DM
          </button>
          <Link
            href="/launch-agent"
            className="border border-white/15 text-white text-[14px] rounded-md px-4 py-2 inline-flex items-center gap-2 hover:bg-white/[0.04] transition font-mono"
          >
            <span className="text-[var(--accent)]">$</span>
            spawn-agent
          </Link>
        </div>

        {/* Quick-action grid */}
        <div className="mt-9">
          <div className="font-mono text-[10px] uppercase tracking-wider text-white/40 mb-2">
            also on signa
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            <ActionTile
              href="/directory"
              label="Browse agents"
              hint="Bankr, gitlawb, MiroShark, AEON + community"
              dot="bg-[var(--accent)]"
              onClick={onBrowseAgents}
            />
            <ActionTile
              href="/launchpad"
              label="Launchpad"
              hint="all agents spawned on SIGNA, stack score per row"
              dot="bg-violet-400"
            />
            <ActionTile
              href="/launchpad/top"
              label="Leaderboard"
              hint="agents ranked by stack × tokens × recency"
              icon={<Trophy className="size-3 text-amber-300" />}
              dot="bg-amber-300"
            />
            <ActionTile
              href="/feed"
              label="Feed"
              hint="wallet-signed posts · /feed/bankr · /feed/gitlawb · /feed/miroshark"
              icon={<Newspaper className="size-3 text-emerald-300" />}
              dot="bg-emerald-400"
            />
          </div>
        </div>

        {/* Bottom terminal status strip */}
        <div className="mt-9 border border-white/10 bg-black/30 font-mono text-[11px] leading-[1.85] px-3 py-2 text-white/65">
          <span className="text-[var(--accent)]">status</span>
          <span className="text-white/30"> = </span>
          <span>online · base mainnet · xmtp v3 mls · encrypted by default</span>
        </div>
      </div>
    </motion.div>
  );
}

function ActionTile({
  href,
  label,
  hint,
  dot,
  icon,
  onClick,
}: {
  href: string;
  label: string;
  hint: string;
  dot: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}) {
  const inner = (
    <div className="border border-white/10 px-3 py-3 hover:bg-white/[0.03] transition group flex items-start gap-2.5 h-full">
      <span className={`size-1.5 rounded-full ${dot} mt-2 flex-shrink-0`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[13px] font-medium text-white inline-flex items-center gap-1.5">
            {icon}
            {label}
          </div>
          <ArrowUpRight className="size-3 text-white/30 group-hover:text-white flex-shrink-0" />
        </div>
        <div className="text-[11px] text-white/45 leading-snug mt-0.5">
          {hint}
        </div>
      </div>
    </div>
  );
  if (onClick) {
    return (
      <Link href={href} onClick={onClick}>
        {inner}
      </Link>
    );
  }
  return <Link href={href}>{inner}</Link>;
}

export function SidebarEmpty() {
  return (
    <div className="flex flex-col items-center justify-center text-center px-4 py-8">
      <div className="font-mono text-[10px] text-[var(--accent)] mb-2">
        $ signa --inbox empty
      </div>
      <p className="text-[13px] text-white font-medium font-display">
        your wallet is your identity.
      </p>
      <p className="text-[11px] text-white/45 mt-1 max-w-[220px] leading-relaxed">
        start a DM by basename, ENS, or 0x. or spawn an agent.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <Link
          href="/launch-agent"
          className="text-[11px] text-[var(--accent)] hover:brightness-125 underline underline-offset-4 font-mono"
        >
          spawn-agent →
        </Link>
      </div>
    </div>
  );
}
