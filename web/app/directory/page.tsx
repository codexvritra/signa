"use client";

import Link from "next/link";
import { ArrowLeft, MessageCircle, Plus } from "lucide-react";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";
import { PeerAvatar } from "@/components/ui/Avatar";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { HolderBadges, EcosystemPill } from "@/components/ui/HolderBadges";
import { shortAddress } from "@/lib/format";
import { useAgents } from "@/hooks/useAgents";
import { Spinner } from "@/components/ui/Spinner";

export default function DirectoryPage() {
  const { agents, loading } = useAgents();

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1">
        <section className="border-b border-white/[0.06]">
          <div className="max-w-5xl mx-auto px-6 lg:px-10 pt-12 pb-12 sm:pt-16 sm:pb-16">
            <Link
              href="/"
              className="text-xs text-white/45 hover:text-white inline-flex items-center gap-1 mb-8"
            >
              <ArrowLeft className="size-3" />
              Back
            </Link>
            <div className="text-xs uppercase tracking-wider text-white/40 mb-3">
              Directory
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-[-0.03em] leading-[1.05] max-w-2xl">
              Agents you can DM.
            </h1>
            <p className="text-white/55 max-w-xl mt-5 text-[16px] leading-relaxed">
              A live list of XMTP agents on Base. Anyone running an agent can{" "}
              <Link
                href="/directory/submit"
                className="text-[var(--accent)] hover:text-[var(--accent-2)] underline underline-offset-2"
              >
                submit theirs
              </Link>{" "}
              — wallet signature from the agent verifies ownership.
            </p>
            <div className="mt-6">
              <Link
                href="/directory/submit"
                className="inline-flex items-center gap-1.5 bg-white text-black text-sm font-medium rounded-md px-3.5 py-1.5 hover:bg-white/90 transition-colors"
              >
                <Plus className="size-3.5" />
                Submit an agent
              </Link>
            </div>
          </div>
        </section>

        <section className="flex-1">
          <div className="max-w-5xl mx-auto px-6 lg:px-10 py-12 sm:py-16">
            {loading ? (
              <div className="flex justify-center py-12 text-white/40">
                <Spinner size={16} />
              </div>
            ) : agents.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[15px] text-white font-medium font-display">
                  No agents listed yet.
                </p>
                <p className="text-sm text-white/55 mt-2 max-w-md mx-auto leading-relaxed">
                  Be the first.{" "}
                  <Link
                    href="/directory/submit"
                    className="text-[var(--accent)] hover:text-[var(--accent-2)] underline underline-offset-2"
                  >
                    Submit your agent
                  </Link>{" "}
                  — takes one signature from the agent&apos;s wallet.
                </p>
              </div>
            ) : (
              <div className="border-t border-white/[0.06]">
                {agents.map((a) => (
                  <div
                    key={a.address}
                    className="py-6 border-b border-white/[0.06] grid sm:grid-cols-[60px_1fr_auto] gap-4 sm:gap-6 items-start"
                  >
                    <PeerAvatar address={a.address} size={44} />
                    <div className="min-w-0">
                      <div className="text-[17px] font-medium text-white flex items-center gap-1.5 flex-wrap">
                        <span>{a.name}</span>
                        {a.verified && <VerifiedBadge size={13} />}
                        {a.is_ecosystem && <EcosystemPill />}
                      </div>
                      <div className="text-[11px] font-mono text-white/40 mt-0.5">
                        {shortAddress(a.address, 10, 8)}
                      </div>
                      <p className="text-sm text-white/60 mt-2 max-w-lg leading-relaxed">
                        {a.description}
                      </p>
                      {a.holdings && a.holdings.length > 0 && (
                        <div className="mt-3">
                          <div className="text-[9px] uppercase tracking-wider text-white/35 mb-1">
                            Holdings
                          </div>
                          <HolderBadges holdings={a.holdings} showAmount />
                        </div>
                      )}
                      {a.tags && a.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {a.tags.map((t) => (
                            <span
                              key={t}
                              className="text-[10px] uppercase tracking-wider text-white/55 border border-white/[0.1] rounded-full px-2 py-0.5"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <Link
                      href={`/?to=${a.address}`}
                      className="bg-white text-black text-sm font-medium rounded-md px-3.5 py-1.5 inline-flex items-center gap-1.5 hover:bg-white/90 transition-colors self-center"
                    >
                      <MessageCircle className="size-3.5" />
                      Message
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
