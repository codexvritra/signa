import { cn } from "@/lib/cn";
import type { HolderChip } from "@/lib/feed-types";

const COLORS: Record<string, string> = {
  BNKR: "border-violet-400/30 text-violet-200 bg-violet-400/10",
  GITLAWB: "border-emerald-400/30 text-emerald-200 bg-emerald-400/10",
  MIRO: "border-cyan-400/30 text-cyan-200 bg-cyan-400/10",
  USDC: "border-blue-400/30 text-blue-200 bg-blue-400/10",
};

/**
 * Compact row of "holds X token" chips for an address. Used in the agent
 * directory + profile views to visually surface which partner-token
 * ecosystems the wallet participates in.
 */
export function HolderBadges({
  holdings,
  className,
  showAmount = false,
}: {
  holdings: HolderChip[] | undefined;
  className?: string;
  showAmount?: boolean;
}) {
  if (!holdings || holdings.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {holdings.map((h) => (
        <span
          key={h.symbol}
          title={
            h.project
              ? `Holds ${h.amount} ${h.symbol} — ${h.project} ecosystem`
              : `Holds ${h.amount} ${h.symbol}`
          }
          className={cn(
            "inline-flex items-center gap-1 rounded-full text-[10px] uppercase tracking-[0.06em] font-medium px-1.5 py-0.5 border",
            COLORS[h.symbol] ?? "border-white/15 text-white/65 bg-white/[0.04]",
          )}
        >
          <span>{h.symbol}</span>
          {showAmount && (
            <span className="font-mono normal-case tracking-normal opacity-80">
              {h.amount}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

export function EcosystemPill({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "rounded-sm font-medium uppercase tracking-[0.08em] inline-flex items-center text-[9px] px-1.5 py-0 border border-[var(--accent)]/30 bg-[var(--accent-dim)] text-[var(--accent)]",
        className,
      )}
      title="Wallet holds at least one partner token (BNKR / GITLAWB / MIRO)"
    >
      Ecosystem
    </span>
  );
}
