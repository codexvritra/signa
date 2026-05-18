import { Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

export function AgentBadge({
  className,
  size = "sm",
}: {
  className?: string;
  size?: "xs" | "sm" | "md";
}) {
  const dims = {
    xs: "text-[8px] px-1 py-0 gap-0.5",
    sm: "text-[9px] px-1.5 py-0.5 gap-0.5",
    md: "text-[10px] px-2 py-0.5 gap-1",
  }[size];
  const icon = {
    xs: "size-2",
    sm: "size-2.5",
    md: "size-3",
  }[size];
  return (
    <span
      className={cn(
        "brand-gradient text-white rounded-full font-semibold uppercase tracking-wider inline-flex items-center",
        dims,
        className,
      )}
    >
      <Sparkles className={icon} />
      Agent
    </span>
  );
}
