"use client";

import { motion } from "framer-motion";
import { MessageSquare } from "lucide-react";

export function ConversationEmptyState({
  onNewChat,
  onBrowseAgents,
}: {
  onNewChat: () => void;
  onBrowseAgents: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-1 flex-col items-center justify-center p-8 text-center gap-5"
    >
      <div className="size-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
        <MessageSquare className="size-5 text-white/55" />
      </div>
      <div className="space-y-1.5 max-w-xs">
        <h2 className="text-[17px] font-medium text-white">No chat selected</h2>
        <p className="text-sm text-white/50 leading-relaxed">
          Pick a conversation from the sidebar, start a new one, or browse agents.
        </p>
      </div>
      <div className="flex gap-2 text-sm">
        <button
          onClick={onNewChat}
          className="bg-white text-black font-medium rounded-md px-3.5 py-1.5 hover:bg-white/90 transition-colors"
        >
          New chat
        </button>
        <button
          onClick={onBrowseAgents}
          className="border border-white/[0.12] text-white font-medium rounded-md px-3.5 py-1.5 hover:bg-white/[0.04] transition-colors"
        >
          Browse agents
        </button>
      </div>
    </motion.div>
  );
}

export function SidebarEmpty() {
  return (
    <div className="flex flex-col items-center justify-center text-center px-4 py-8 text-white/40">
      <MessageSquare className="size-5 mb-2 opacity-50" />
      <p className="text-xs">No conversations yet</p>
      <p className="text-[11px] text-white/30 mt-0.5">
        Tap “New chat” to start one
      </p>
    </div>
  );
}
