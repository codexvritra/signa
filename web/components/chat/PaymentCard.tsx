"use client";

import { ArrowUpRight, ArrowDownLeft, ExternalLink, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { weiToEthString } from "@/lib/payment";
import { explorerTx } from "@/lib/chain-links";

type TxMetadata = {
  transactionType?: string;
  currency?: string;
  amount?: number;
  decimals?: number;
  fromAddress?: string;
  toAddress?: string;
};

type TxRefContent = {
  namespace?: string;
  networkId?: string;
  reference?: string;
  metadata?: TxMetadata;
};

export function PaymentCard({
  content,
  isMine,
  onChain,
}: {
  content: TxRefContent;
  isMine: boolean;
  onChain?: boolean;
}) {
  const ref = content.reference ?? "";
  const md = content.metadata;
  const currency = md?.currency ?? "ETH";
  const amount =
    md && typeof md.amount === "number"
      ? weiToEthString(BigInt(Math.trunc(md.amount)), md.decimals ?? 18)
      : null;

  const Icon = isMine ? ArrowUpRight : ArrowDownLeft;
  const directionLabel = isMine ? "Sent" : "Received";

  return (
    <div
      className={cn(
        "w-[260px] max-w-full rounded-md p-3 flex flex-col gap-2",
        isMine
          ? "bg-white text-black"
          : "bg-white/[0.04] border border-white/[0.08] text-white",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-medium opacity-70">
          <Icon className="size-3" />
          {directionLabel}
        </div>
        {onChain && (
          <div
            className={cn(
              "flex items-center gap-1 text-[10px] font-medium",
              isMine ? "text-black/55" : "text-[var(--accent)]",
            )}
          >
            <CheckCircle2 className="size-3" />
            Confirmed
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <div className="text-[22px] font-semibold tracking-tight tabular-nums">
          {amount ?? "—"}
        </div>
        <div className="text-[12px] opacity-65 font-medium">{currency}</div>
      </div>
      {ref && (
        <a
          href={explorerTx(ref)}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "flex items-center gap-1 text-[10px] font-mono pt-0.5",
            isMine ? "text-black/55 hover:text-black" : "text-white/45 hover:text-white",
          )}
        >
          {ref.slice(0, 10)}…{ref.slice(-6)}
          <ExternalLink className="size-2.5" />
        </a>
      )}
    </div>
  );
}
