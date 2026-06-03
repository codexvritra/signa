"use client";

import { useState } from "react";
import { SIGNA, SIGNA_CA_SHORT } from "@/lib/token";

/** Compact, copyable $SIGNA contract address + Basescan link. Factual, not advice. */
export function ContractBadge() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(SIGNA.token.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked — the Basescan link still works */
    }
  }

  return (
    <span className="inline-flex items-center gap-2 font-mono text-[11px]">
      <span className="text-white/45">${SIGNA.token.symbol} on {SIGNA.token.chain}</span>
      <button
        onClick={copy}
        title={`Copy ${SIGNA.token.address}`}
        className="text-white/55 hover:text-white transition-colors border border-white/10 rounded px-1.5 py-0.5"
      >
        {copied ? "copied" : SIGNA_CA_SHORT}
      </button>
      <a
        href={SIGNA.token.basescan}
        target="_blank"
        rel="noopener noreferrer"
        className="text-white/40 hover:text-white transition-colors"
      >
        basescan
      </a>
    </span>
  );
}
