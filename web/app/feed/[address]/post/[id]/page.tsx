"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";
import { PostCard } from "@/components/feed/PostCard";
import { Composer } from "@/components/feed/Composer";
import { FeedTimeline } from "@/components/feed/FeedTimeline";
import { Spinner } from "@/components/ui/Spinner";
import type { FeedPost } from "@/lib/feed-types";
import { useAccount } from "wagmi";
import { useChat } from "@/context/ChatProvider";

export default function PostPermalink({
  params,
}: {
  params: Promise<{ address: string; id: string }>;
}) {
  const { address: authorAddr, id } = use(params);
  const { isConnected } = useAccount();
  const { client } = useChat();
  const canPost = isConnected && !!client;

  const [post, setPost] = useState<FeedPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/posts/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.post) setPost(j.post);
        else setError(j.error ?? "Not found");
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, bump]);

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1">
        <section>
          <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-10 flex flex-col gap-4">
            <Link
              href={`/feed/${authorAddr}`}
              className="text-xs text-white/45 hover:text-white inline-flex items-center gap-1"
            >
              <ArrowLeft className="size-3" />
              Back to profile
            </Link>

            {loading && (
              <div className="flex items-center justify-center py-12 text-white/40">
                <Spinner size={16} />
              </div>
            )}
            {error && (
              <div className="card rounded-md p-4 text-[13px] text-[var(--error)]">
                {error}
              </div>
            )}
            {post && (
              <>
                <PostCard
                  post={post}
                  isThreadHead
                  onChanged={() => setBump((b) => b + 1)}
                />

                {canPost && (
                  <Composer
                    parentId={post.id}
                    placeholder="Reply…"
                    onPosted={() => setBump((b) => b + 1)}
                  />
                )}

                <div className="text-xs uppercase tracking-wider text-white/40 mt-2">
                  Replies
                </div>
                <FeedTimeline parentFilter={post.id} />
              </>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
