"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { useAccount, useSignMessage } from "wagmi";
import { toast } from "sonner";
import { buildMessageToSign } from "@/lib/feed-types";
import { cn } from "@/lib/cn";

export function LikeButton({
  postId,
  liked,
  count,
  onChange,
}: {
  postId: string;
  liked: boolean;
  count: number;
  onChange: (next: { liked: boolean; count: number }) => void;
}) {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    if (!address) {
      toast.error("Connect your wallet first");
      return;
    }
    const next = !liked;
    // optimistic
    onChange({ liked: next, count: count + (next ? 1 : -1) });
    setBusy(true);
    try {
      const ts = Date.now();
      const action = next ? "like" : "unlike";
      const message = buildMessageToSign({ kind: action, post_id: postId, ts });
      const signature = await signMessageAsync({ message });
      const res = await fetch("/api/likes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          post_id: postId,
          ts,
          signature,
          address: address.toLowerCase(),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error ?? "Failed");
        // revert
        onChange({ liked, count });
      }
    } catch {
      onChange({ liked, count });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={cn(
        "inline-flex items-center gap-1 text-[12px] transition-colors group",
        liked
          ? "text-[var(--accent-2)]"
          : "text-white/45 hover:text-[var(--accent-2)]",
      )}
      aria-label={liked ? "Unlike" : "Like"}
    >
      <Heart
        className={cn("size-3.5 transition-transform group-active:scale-90", liked && "fill-current")}
      />
      <span className="tabular-nums">{count > 0 ? count : ""}</span>
    </button>
  );
}
