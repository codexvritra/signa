"use client";

import Link from "next/link";
import { use } from "react";
import { ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";
import { FeedTimeline } from "@/components/feed/FeedTimeline";
import { PeerAvatar } from "@/components/ui/Avatar";
import { PeerName } from "@/components/ui/PeerName";
import { shortAddress } from "@/lib/format";

export default function ProfileFeedPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = use(params);
  const lower = address.toLowerCase();
  const isAddress = /^0x[a-f0-9]{40}$/.test(lower);

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1">
        <section className="border-b border-white/[0.06]">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-10 pb-6">
            <Link
              href="/feed"
              className="text-xs text-white/45 hover:text-white inline-flex items-center gap-1 mb-6"
            >
              <ArrowLeft className="size-3" />
              Back to feed
            </Link>
            <div className="flex items-center gap-3">
              <PeerAvatar address={isAddress ? lower : null} size={48} />
              <div className="min-w-0">
                <div className="font-display text-2xl font-semibold tracking-tight text-white truncate">
                  {isAddress ? (
                    <PeerName address={lower} fallback={shortAddress(lower)} />
                  ) : (
                    lower
                  )}
                </div>
                <div className="text-[11px] font-mono text-white/40 truncate">
                  {isAddress ? lower : "name not resolved"}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
            {isAddress ? (
              <FeedTimeline authorFilter={lower} />
            ) : (
              <div className="text-center py-12 text-[13px] text-white/55">
                That handle isn&apos;t a valid wallet address. Profile feeds
                are by 0x address.
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
