import { cn } from "@/lib/cn";

/**
 * Logo mark: two stacked, offset rounded rectangles suggesting
 * a message exchange. Stark white-on-black, no gradient.
 */
export function LogoMark({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size * (24 / 28)}
      viewBox="0 0 28 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-foreground", className)}
      aria-hidden
    >
      <rect
        x="0.5"
        y="0.5"
        width="17"
        height="11"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <rect x="10" y="10" width="18" height="14" rx="3" fill="currentColor" />
    </svg>
  );
}
