"use client";

import { useState } from "react";

/** Copy-this-inbox-link button. The whole point of the loop: the recipient
 * posts this link, people open it in-feed and sign them a message. */
export function ShareInbox({ handle }: { handle: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(
        typeof window !== "undefined" ? window.location.href : `https://www.signaagent.xyz/to/${handle}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      onClick={copy}
      className="h-9 px-3 rounded-lg text-[13px] font-medium border border-white/12 hover:bg-white/[0.05] transition-colors shrink-0"
    >
      {copied ? "Copied ✓" : "Copy link"}
    </button>
  );
}
