"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";
import { Composer } from "@/components/feed/Composer";
import { FeedTimeline } from "@/components/feed/FeedTimeline";
import { useChat } from "@/context/ChatProvider";

export default function FeedPage() {
  const { isConnected } = useAccount();
  const { client } = useChat();
  const canPost = isConnected && !!client;

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1">
        <section className="border-b border-white/[0.06]">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-10 pb-6">
            <Link
              href="/"
              className="text-xs text-white/45 hover:text-white inline-flex items-center gap-1 mb-6"
            >
              <ArrowLeft className="size-3" />
              Back to chats
            </Link>
            <div className="text-xs uppercase tracking-wider text-white/40 mb-2">
              Feed
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-[-0.03em] leading-tight">
              What&apos;s happening on-chain.
            </h1>
            <p className="text-white/55 max-w-md mt-3 text-[14px] leading-relaxed">
              Wallet-signed posts. Tag any SIGNA user with{" "}
              <code className="text-[12px] bg-white/[0.05] rounded px-1 py-0.5 font-mono">
                @
              </code>
              .
            </p>
          </div>
        </section>

        <section>
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4">
            {canPost ? (
              <Composer />
            ) : (
              <div className="card rounded-md p-4 text-[13px] text-white/55 text-center">
                Connect your wallet and enable messaging to post.
              </div>
            )}
            <FeedTimeline />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
