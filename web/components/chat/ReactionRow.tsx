"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { DecodedMessage } from "@xmtp/browser-sdk";
import { cn } from "@/lib/cn";

type ReactionAggregate = {
  emoji: string;
  count: number;
  mine: boolean;
};

export function ReactionRow({
  message,
  ownInboxId,
  onToggle,
  align,
}: {
  message: DecodedMessage;
  ownInboxId: string | null;
  onToggle: (emoji: string, action: "add" | "remove") => void;
  align: "left" | "right";
}) {
  const aggregates = useMemo<ReactionAggregate[]>(() => {
    const reactions = (
      message as unknown as {
        reactions?: Array<{
          content?: { content?: string; action?: number };
          senderInboxId?: string;
        }>;
      }
    ).reactions;
    if (!reactions || reactions.length === 0) return [];
    // Build net state: action=1 added, action=2 removed
    const stateByEmojiBySender: Map<string, Map<string, boolean>> = new Map();
    for (const r of reactions) {
      const emoji = r.content?.content;
      const action = r.content?.action;
      const sender = r.senderInboxId;
      if (!emoji || !sender) continue;
      let perSender = stateByEmojiBySender.get(emoji);
      if (!perSender) {
        perSender = new Map();
        stateByEmojiBySender.set(emoji, perSender);
      }
      if (action === 2) {
        perSender.set(sender, false);
      } else {
        perSender.set(sender, true);
      }
    }
    const out: ReactionAggregate[] = [];
    for (const [emoji, perSender] of stateByEmojiBySender) {
      let count = 0;
      let mine = false;
      for (const [sender, on] of perSender) {
        if (on) {
          count++;
          if (sender === ownInboxId) mine = true;
        }
      }
      if (count > 0) out.push({ emoji, count, mine });
    }
    return out;
  }, [message, ownInboxId]);

  if (aggregates.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap gap-1 mt-1",
        align === "right" ? "justify-end" : "justify-start",
      )}
    >
      {aggregates.map((a) => (
        <motion.button
          key={a.emoji}
          type="button"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          transition={{ duration: 0.12 }}
          onClick={() => onToggle(a.emoji, a.mine ? "remove" : "add")}
          className={cn(
            "text-[11px] rounded-full px-1.5 py-0.5 flex items-center gap-0.5 border transition-colors",
            a.mine
              ? "bg-[var(--accent-dim)] border-[var(--accent)]/30 text-white"
              : "bg-white/[0.05] border-white/10 text-white/80 hover:bg-white/[0.08]",
          )}
        >
          <span className="text-sm leading-none">{a.emoji}</span>
          <span className="font-medium">{a.count}</span>
        </motion.button>
      ))}
    </div>
  );
}
