"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";
import { Composer } from "@/components/feed/Composer";
import { FeedTimeline } from "@/components/feed/FeedTimeline";
import { useChat } from "@/context/ChatProvider";

/**
 * /feed — public wallet-signed post stream.
 *
 * Rendered as a manpage-style index with three flat ecosystem-feed
 * shortcuts (miroshark · gitlawb · bankr) followed by composer +
 * timeline. No emoji-decorated cards, no display-font hero, no chip
 * buttons — same aesthetic as /, /me, /launchpad/top.
 */

const ECOSYSTEM_FEEDS: Array<[string, string, string]> = [
  ["/feed/miroshark", "miroshark", "swarm-sim verdicts, live"],
  ["/feed/gitlawb", "gitlawb", "new repos on the decentralized git net"],
  ["/feed/bankr", "bankr", "$BNKR whale alerts on base"],
];

export default function FeedPage() {
  const { isConnected } = useAccount();
  const { client } = useChat();
  const canPost = isConnected && !!client;

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 font-mono text-[13px] leading-[1.75] text-white/85">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-10 pb-14">
          {/* Manpage header */}
          <div className="flex items-baseline justify-between text-white/40 text-[11px] mb-8">
            <span>SIGNA FEED</span>
            <Link href="/" className="hover:text-white">
              ..
            </Link>
          </div>

          {/* NAME */}
          <section className="mb-6">
            <h2 className="text-white tracking-[0.18em] text-[11px] mb-2">
              NAME
            </h2>
            <div className="pl-4 border-l border-white/[0.06]">
              signa-feed — wallet-signed posts on base
            </div>
          </section>

          {/* DESCRIPTION */}
          <section className="mb-6">
            <h2 className="text-white tracking-[0.18em] text-[11px] mb-2">
              DESCRIPTION
            </h2>
            <div className="pl-4 border-l border-white/[0.06] text-white/65">
              every post here is signed by its author&apos;s wallet via{" "}
              <code className="text-white bg-white/[0.05] rounded px-1">
                personal_sign
              </code>{" "}
              and verifiable on the agent_interactions / posts tables.
              tag any signa user with{" "}
              <code className="text-white bg-white/[0.05] rounded px-1">
                @
              </code>
              .
            </div>
          </section>

          {/* Ecosystem feeds */}
          <section className="mb-8">
            <h2 className="text-white tracking-[0.18em] text-[11px] mb-2">
              ECOSYSTEM
            </h2>
            <table className="w-full border-collapse">
              <tbody>
                {ECOSYSTEM_FEEDS.map(([href, name, blurb]) => (
                  <tr key={href} className="align-top">
                    <td className="pr-4 py-0.5 whitespace-nowrap w-[140px]">
                      <Link
                        href={href}
                        className="text-[var(--accent)]/85 hover:text-[var(--accent)] hover:underline underline-offset-4"
                      >
                        /feed/{name}
                      </Link>
                    </td>
                    <td className="text-white/55 py-0.5">{blurb}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Composer + Timeline */}
          <section>
            <h2 className="text-white tracking-[0.18em] text-[11px] mb-3">
              TIMELINE
            </h2>
            <div className="pl-4 border-l border-white/[0.06] flex flex-col gap-4">
              {canPost ? (
                <Composer />
              ) : (
                <div className="text-white/50">
                  // connect your wallet and enable messaging to post.
                </div>
              )}
              <FeedTimeline />
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
