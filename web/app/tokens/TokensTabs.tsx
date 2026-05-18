"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";

export function TokensTabs({ current }: { current: "trending" | "new" }) {
  return (
    <div className="inline-flex border border-white/10 font-mono text-[12px]">
      <Link
        href="/tokens?tab=trending"
        className={cn(
          "px-3 py-1.5 transition-colors",
          current === "trending"
            ? "bg-[var(--accent)] text-black font-semibold"
            : "text-white/65 hover:text-white",
        )}
      >
        $ trending
      </Link>
      <Link
        href="/tokens?tab=new"
        className={cn(
          "px-3 py-1.5 border-l border-white/10 transition-colors",
          current === "new"
            ? "bg-[var(--accent)] text-black font-semibold"
            : "text-white/65 hover:text-white",
        )}
      >
        $ new launches
      </Link>
    </div>
  );
}
