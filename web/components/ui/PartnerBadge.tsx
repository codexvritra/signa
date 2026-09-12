import { cn } from "@/lib/cn";

/**
 * "Built with" pill for entries SIGDA integrates on top of (Bankr, gitlawb,
 * AEON, MiroShark). Deliberately NOT called "Partner" — they haven't
 * signed anything with us; SIGDA is built using their primitives.
 *
 * Visual lineage:
 *   - AgentBadge    → registered XMTP agent (violet pill)
 *   - VerifiedBadge → admin-vouched community agent (blue scalloped ✓)
 *   - <this>        → integration SIGDA ships on top of (purple "BUILT WITH" pill)
 */
export function PartnerBadge({
  className,
  size = "sm",
}: {
  className?: string;
  size?: "xs" | "sm" | "md";
}) {
  const dims = {
    xs: "text-[9px] px-1.5 py-0",
    sm: "text-[10px] px-1.5 py-0.5",
    md: "text-[11px] px-2 py-0.5",
  }[size];
  return (
    <span
      className={cn(
        "rounded-sm font-semibold uppercase tracking-[0.08em] inline-flex items-center bg-[var(--accent-2-dim)] text-[var(--accent-2)] border border-[var(--accent-2)]/35",
        dims,
        className,
      )}
      title="SIGDA is built using this project's primitives — see the integration note below"
    >
      Built with
    </span>
  );
}
