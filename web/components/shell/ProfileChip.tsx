"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useChat } from "@/context/ChatProvider";
import { PeerAvatar } from "@/components/ui/Avatar";
import { PeerName } from "@/components/ui/PeerName";
import { shortAddress } from "@/lib/format";
import { useDisplayName } from "@/hooks/useDisplayName";
import { XMTP_ENV } from "@/lib/xmtp";

export function ProfileChip() {
  const { ownAddress } = useChat();
  const [displayName] = useDisplayName();
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!ownAddress) return;
    try {
      await navigator.clipboard.writeText(ownAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
      toast.success("Address copied");
    } catch {
      toast.error("Couldn't copy");
    }
  }

  if (!ownAddress) return null;

  return (
    <div className="px-3 pb-3 pt-1">
      <div className="glass rounded-xl p-2.5 flex items-center gap-2.5">
        <PeerAvatar address={ownAddress} size={28} />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-white truncate flex items-center gap-1.5">
            <span className="truncate">
              {displayName ? (
                displayName
              ) : (
                <PeerName address={ownAddress} fallback={shortAddress(ownAddress)} />
              )}
            </span>
            <span
              className="text-[8px] uppercase tracking-wider font-semibold bg-amber-400/15 text-amber-200 border border-amber-300/20 rounded-full px-1.5 py-0.5 flex-shrink-0"
              title={`Connected to the XMTP "${XMTP_ENV}" network`}
            >
              {XMTP_ENV}
            </span>
          </div>
          <div className="text-[10px] font-mono text-white/40 truncate">
            {shortAddress(ownAddress, 6, 4)}
          </div>
        </div>
        <button
          onClick={copy}
          className="text-white/50 hover:text-white p-1 rounded-md hover:bg-white/[0.06] transition-colors"
          aria-label="Copy address"
          title="Copy your address"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        </button>
      </div>
    </div>
  );
}
