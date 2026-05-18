"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { SmilePlus, Reply } from "lucide-react";
import type { DecodedMessage } from "@xmtp/browser-sdk";
import { cn } from "@/lib/cn";
import { formatTime, nsToDate } from "@/lib/format";
import { renderTextWithLinks } from "@/lib/text";
import { ReactionPicker } from "./ReactionPicker";
import { ReactionRow } from "./ReactionRow";
import { useChat } from "@/context/ChatProvider";

export function MessageBubble({
  message,
  isMine,
  showTime,
  onReply,
}: {
  message: DecodedMessage;
  isMine: boolean;
  showTime: boolean;
  onReply: (msg: DecodedMessage) => void;
}) {
  const { sendReaction, ownInboxId } = useChat();
  const [pickerOpen, setPickerOpen] = useState(false);

  const content = typeof message.content === "string" ? message.content : "";
  // for replies, content can be string too (decoded text reply)
  const isReplyMsg = !!(message as unknown as { contentType?: { typeId?: string } })
    .contentType?.typeId?.includes("reply");

  if (!content && !isReplyMsg) return null;

  const sentAt = (() => {
    try {
      const ns = (message as unknown as { sentAtNs?: bigint }).sentAtNs;
      if (ns) return nsToDate(ns);
    } catch {
      // ignore
    }
    return null;
  })();

  function handlePick(emoji: string) {
    setPickerOpen(false);
    void sendReaction(message.id, emoji, "add");
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={cn("group flex w-full", isMine ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "flex max-w-[80%] flex-col gap-1 relative",
          isMine && "items-end",
        )}
      >
        <div className="relative">
          <div
            className={cn(
              "rounded-2xl px-3.5 py-2 text-sm leading-snug break-words shadow-sm",
              isMine
                ? "bg-white text-black"
                : "bg-white/[0.06] text-white/95 border border-white/10",
            )}
          >
            {renderTextWithLinks(content, isMine)}
          </div>

          {/* hover actions */}
          <div
            className={cn(
              "absolute top-0 hidden group-hover:flex items-center gap-0.5 -translate-y-1/2 z-10",
              isMine ? "-left-14" : "-right-14",
            )}
          >
            <button
              onClick={() => setPickerOpen((v) => !v)}
              className="size-6 rounded-full glass-strong flex items-center justify-center text-white/70 hover:text-white transition-colors"
              aria-label="React"
            >
              <SmilePlus className="size-3" />
            </button>
            <button
              onClick={() => onReply(message)}
              className="size-6 rounded-full glass-strong flex items-center justify-center text-white/70 hover:text-white transition-colors"
              aria-label="Reply"
            >
              <Reply className="size-3" />
            </button>
          </div>

          <ReactionPicker
            open={pickerOpen}
            onPick={handlePick}
            align={isMine ? "right" : "left"}
          />
        </div>

        <ReactionRow
          message={message}
          ownInboxId={ownInboxId}
          align={isMine ? "right" : "left"}
          onToggle={(emoji, action) => sendReaction(message.id, emoji, action)}
        />

        {showTime && sentAt && (
          <span className="text-[10px] text-white/30 px-1">
            {formatTime(sentAt)}
          </span>
        )}
      </div>
    </motion.div>
  );
}
