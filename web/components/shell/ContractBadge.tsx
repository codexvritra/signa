"use client";

import { useState } from "react";
import { SIGDA, SIGDA_CA_SHORT } from "@/lib/token";

/** Compact, copyable $SIGDA contract address + Basescan link. Factual, not advice. */
export function ContractBadge() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(SIGDA.token.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked — the Basescan link still works */
    }
  }

  return (
    <span className="inline-flex items-center gap-2 font-mono text-[11px]">
      <span className="text-white/45">${SIGDA.token.symbol} on {SIGDA.token.chain}</span>
      <button
        onClick={copy}
        title={`Copy ${SIGDA.token.address}`}
        className="text-white/55 hover:text-white transition-colors border border-white/10 rounded px-1.5 py-0.5"
      >
        {copied ? "copied" : SIGDA_CA_SHORT}
      </button>
      <a
        href={SIGDA.token.basescan}
        target="_blank"
        rel="noopener noreferrer"
        className="text-white/40 hover:text-white transition-colors"
      >
        basescan
      </a>
    </span>
  );
}
