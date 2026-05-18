"use client";

import { useState, type KeyboardEvent } from "react";
import { ArrowUp, X, CornerDownRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";

export type ReplyTarget = {
  id: string;
  preview: string;
  authorLabel: string;
};

export function MessageInput({
  disabled,
  replyTarget,
  onClearReply,
  onSend,
}: {
  disabled?: boolean;
  replyTarget: ReplyTarget | null;
  onClearReply: () => void;
  onSend: (text: string, replyToId?: string) => Promise<void> | void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || sending || disabled) return;
    setSending(true);
    setText("");
    try {
      await onSend(trimmed, replyTarget?.id);
      onClearReply();
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
    if (e.key === "Escape" && replyTarget) {
      onClearReply();
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <AnimatePresence>
        {replyTarget && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="glass rounded-xl px-3 py-2 flex items-center gap-2 text-xs"
          >
            <CornerDownRight className="size-3.5 text-violet-300 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-violet-300 font-medium">
                Replying to {replyTarget.authorLabel}
              </div>
              <div className="text-white/50 truncate">{replyTarget.preview}</div>
            </div>
            <button
              onClick={onClearReply}
              className="text-white/40 hover:text-white p-1 flex-shrink-0"
              aria-label="Cancel reply"
            >
              <X className="size-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="glass rounded-2xl px-3 py-2 flex items-end gap-2 focus-within:border-white/20 transition-colors">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder={replyTarget ? "Type your reply…" : "Type a message…"}
          disabled={disabled || sending}
          className={cn(
            "flex-1 resize-none bg-transparent text-sm text-white outline-none placeholder:text-white/30",
            "min-h-[24px] max-h-[120px] py-1.5",
          )}
          style={{
            height: Math.min(120, Math.max(24, text.split("\n").length * 20 + 4)),
          }}
        />
        <button
          type="button"
          onClick={send}
          disabled={!text.trim() || disabled || sending}
          className={cn(
            "size-8 rounded-full flex items-center justify-center transition-all",
            text.trim() && !disabled && !sending
              ? "brand-gradient text-white shadow-lg hover:scale-105 active:scale-95"
              : "bg-white/5 text-white/30 cursor-not-allowed",
          )}
          aria-label="Send"
        >
          <ArrowUp className="size-4" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
