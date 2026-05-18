"use client";

import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import {
  isWatched,
  addToWatchlist,
  removeFromWatchlist,
} from "@/lib/watchlist";
import { toast } from "sonner";

/**
 * Bookmark/unbookmark a token. State is localStorage; survives reload.
 * No auth required — anyone can build their own watchlist immediately.
 */
export function WatchButton({
  address,
  symbol,
}: {
  address: string;
  symbol: string;
}) {
  const [watched, setWatched] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setWatched(isWatched(address));
  }, [address]);

  function toggle() {
    if (watched) {
      removeFromWatchlist(address);
      setWatched(false);
      toast.success(`$${symbol || "token"} removed from watchlist`);
    } else {
      addToWatchlist(address);
      setWatched(true);
      toast.success(`$${symbol || "token"} added to watchlist`);
    }
  }

  if (!mounted) {
    // Avoid SSR-vs-client mismatch — render a neutral placeholder until
    // localStorage is readable.
    return (
      <button
        disabled
        className="border border-white/10 text-white/40 rounded-md px-3 py-2 text-[13px] inline-flex items-center gap-1.5 cursor-default"
      >
        <Bookmark className="size-3.5" />
        watch
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      className={
        watched
          ? "border border-amber-300/40 bg-amber-300/[0.06] text-amber-200 rounded-md px-3 py-2 text-[13px] inline-flex items-center gap-1.5 hover:brightness-110 transition"
          : "border border-white/15 text-white rounded-md px-3 py-2 text-[13px] inline-flex items-center gap-1.5 hover:bg-white/[0.04] transition"
      }
      title={
        watched
          ? `Remove $${symbol} from your watchlist`
          : `Add $${symbol} to your watchlist`
      }
    >
      {watched ? (
        <BookmarkCheck className="size-3.5" />
      ) : (
        <Bookmark className="size-3.5" />
      )}
      {watched ? "watching" : "watch"}
    </button>
  );
}
