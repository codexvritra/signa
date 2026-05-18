"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import type { FeedPost } from "@/lib/feed-types";
import { PostCard } from "./PostCard";
import { Spinner } from "@/components/ui/Spinner";

type Props = {
  authorFilter?: string;
  parentFilter?: string;
};

export function FeedTimeline({ authorFilter, parentFilter }: Props) {
  const { address } = useAccount();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(
    async (mode: "fresh" | "more") => {
      const myId = ++requestId.current;
      if (mode === "fresh") {
        setLoading(true);
        setDone(false);
      } else {
        if (done || loadingMore) return;
        setLoadingMore(true);
      }

      const params = new URLSearchParams();
      params.set("limit", "30");
      if (authorFilter) params.set("author", authorFilter.toLowerCase());
      if (parentFilter) params.set("parent", parentFilter);
      if (address) params.set("viewer", address.toLowerCase());
      if (mode === "more" && cursor) params.set("cursor", cursor);

      try {
        const res = await fetch(`/api/posts?${params.toString()}`);
        const json = (await res.json()) as { posts: FeedPost[]; error?: string };
        if (requestId.current !== myId) return;
        const got = json.posts ?? [];
        setPosts((prev) => (mode === "fresh" ? got : [...prev, ...got]));
        if (got.length === 0) {
          setDone(true);
        } else {
          setCursor(got[got.length - 1].created_at);
        }
      } catch {
        // silent — UI shows what's loaded
      } finally {
        if (requestId.current === myId) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [authorFilter, parentFilter, cursor, address, done, loadingMore],
  );

  useEffect(() => {
    setPosts([]);
    setCursor(null);
    setDone(false);
    void load("fresh");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorFilter, parentFilter, address]);

  function refresh() {
    setCursor(null);
    setDone(false);
    void load("fresh");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-white/40">
        <Spinner size={16} />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-[13px] text-white/55 font-medium font-display">
          {parentFilter
            ? "No replies yet."
            : authorFilter
              ? "No posts here yet."
              : "Feed is quiet. Be the first."}
        </div>
        <div className="text-[11px] text-white/35 mt-1">
          Posts require XMTP to be enabled.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} onChanged={refresh} />
      ))}
      {!done && (
        <button
          onClick={() => void load("more")}
          disabled={loadingMore}
          className="text-[12px] text-white/55 hover:text-white py-3 inline-flex items-center justify-center gap-2"
        >
          {loadingMore ? <Spinner size={11} /> : "Load older"}
        </button>
      )}
      {done && posts.length > 0 && (
        <div className="text-center text-[11px] text-white/30 py-4">
          End of feed.
        </div>
      )}
    </div>
  );
}
