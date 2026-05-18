"use client";

import { motion } from "framer-motion";
import { Users } from "lucide-react";
import type { Conversation, DecodedMessage } from "@xmtp/browser-sdk";
import { cn } from "@/lib/cn";
import { formatRelative, nsToDate, shortAddress } from "@/lib/format";
import { PeerAvatar } from "@/components/ui/Avatar";
import { PeerName } from "@/components/ui/PeerName";
import { AgentBadge } from "@/components/ui/AgentBadge";
import { isGroup, getGroupName } from "@/lib/conversation";
import { isKnownAgentAddress, getKnownAgent } from "@/lib/agents";
import { getMessageText } from "@/lib/message";
import type { PeerInfo } from "@/context/ChatProvider";

export function ConversationItem({
  conversation,
  peerInfo,
  active,
  unread,
  lastMessage,
  onSelect,
}: {
  conversation: Conversation;
  peerInfo: PeerInfo | undefined;
  active: boolean;
  unread: number;
  lastMessage: DecodedMessage | undefined;
  onSelect: () => void;
}) {
  const peerAddress = peerInfo?.address ?? null;
  const isGroupConv = isGroup(conversation);
  const groupName = isGroupConv ? getGroupName(conversation) : undefined;
  const isAgent = !isGroupConv && isKnownAgentAddress(peerAddress);
  const knownAgent = isAgent ? getKnownAgent(peerAddress) : null;

  const lastText = lastMessage ? getMessageText(lastMessage) : "";

  const lastAt = (() => {
    try {
      const ns = (lastMessage as unknown as { sentAtNs?: bigint } | undefined)?.sentAtNs;
      if (ns) return nsToDate(ns);
    } catch {
      // ignore
    }
    return null;
  })();

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.1 }}
      className={cn(
        "w-full text-left rounded-xl p-2.5 flex gap-3 items-center transition-colors",
        active
          ? "bg-white/[0.07] border border-white/10"
          : "border border-transparent hover:bg-white/[0.03]",
      )}
    >
      {isGroupConv ? (
        <div className="size-9 rounded-full brand-gradient flex items-center justify-center flex-shrink-0">
          <Users className="size-4 text-white" />
        </div>
      ) : (
        <PeerAvatar address={peerAddress} size={36} />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-white truncate flex items-center gap-1.5 min-w-0">
            <span className="truncate">
              {isGroupConv ? (
                groupName ?? "Untitled group"
              ) : knownAgent ? (
                knownAgent.name
              ) : peerAddress ? (
                <PeerName address={peerAddress} />
              ) : (
                shortAddress(conversation.id, 4, 4)
              )}
            </span>
            {isAgent && <AgentBadge size="xs" />}
          </span>
          {lastAt && (
            <span className="text-[10px] text-white/30 flex-shrink-0">
              {formatRelative(lastAt)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-xs text-white/45 truncate">
            {lastText || "no messages yet"}
          </span>
          {unread > 0 && (
            <span className="text-[10px] font-semibold brand-gradient text-white rounded-full px-1.5 min-w-[18px] h-[18px] flex items-center justify-center flex-shrink-0">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}
