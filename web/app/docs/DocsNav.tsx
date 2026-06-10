"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/docs", label: "Overview" },
  { href: "/docs/messaging", label: "Messaging" },
  { href: "/docs/brain", label: "The Brain" },
  { href: "/docs/budgets", label: "Budgets" },
  { href: "/docs/x402", label: "x402 Receipts" },
  { href: "/docs/capabilities", label: "Capabilities" },
  { href: "/docs/sdks", label: "SDKs & MCP" },
  { href: "/docs/verify", label: "Verify & Security" },
];

export function DocsNav() {
  const pathname = usePathname();
  return (
    <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
      {LINKS.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`shrink-0 px-3 py-2 rounded-lg text-[13.5px] transition-colors ${
              active ? "bg-white/[0.08] text-white font-medium" : "text-muted hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
