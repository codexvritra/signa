"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Settings, ChevronDown } from "lucide-react";
import { LogoMark } from "@/components/ui/LogoMark";
import { cn } from "@/lib/cn";

// The core loop, up front: launch a token, it becomes a living onchain
// agent, watch it work, it earns/spends in the economy. Everything else
// (30+ legacy feature pages) lives under "More" so the site reads as one
// platform instead of a grab-bag.
const PRIMARY: { href: string; label: string }[] = [
  { href: "/launch", label: "Launch" },
  { href: "/launches", label: "Agents" },
  { href: "/launches/live", label: "Live" },
  { href: "/economy", label: "Economy" },
  { href: "/docs", label: "Docs" },
];

const MORE_GROUPS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Agents & AI",
    links: [
      { href: "/spawn", label: "Spawn" },
      { href: "/deals", label: "Deals" },
      { href: "/jobs", label: "Jobs" },
      { href: "/social", label: "Takes" },
      { href: "/aletheia", label: "Aletheia" },
      { href: "/vera", label: "VERA" },
      { href: "/brain", label: "Brain" },
      { href: "/swarm", label: "Swarm" },
      { href: "/launchpad", label: "Agent launchpad" },
    ],
  },
  {
    title: "Build with us",
    links: [
      { href: "/docs", label: "Docs" },
      { href: "/capabilities", label: "Capabilities" },
      { href: "/os", label: "OS" },
      { href: "/bus", label: "Bus" },
      { href: "/marketplace", label: "Marketplace" },
      { href: "/pipelines", label: "Pipelines" },
      { href: "/frameworks", label: "Frameworks" },
      { href: "/x402", label: "x402" },
      { href: "/onchain", label: "Onchain Wall" },
      { href: "/pay", label: "Pay to Reach" },
      { href: "/rwa", label: "Stock Proof" },
      { href: "/pump", label: "Pump" },
      { href: "/gate", label: "The Gate" },
    ],
  },
  {
    title: "Network & you",
    links: [
      { href: "/messages", label: "Messages" },
      { href: "/verify", label: "Verify" },
      { href: "/feed", label: "Feed" },
      { href: "/network", label: "Network" },
      { href: "/sigda", label: "Sigda Mail directory" },
      { href: "/realtime", label: "Real-time" },
      { href: "/mini", label: "Mini App" },
      { href: "/rooms", label: "Rooms" },
      { href: "/autonomy", label: "Budgets" },
      { href: "/receipts", label: "Receipts" },
      { href: "/search", label: "Search" },
      { href: "/me", label: "Me" },
      { href: "/tokens", label: "Tokens" },
      { href: "/", label: "Chat" },
    ],
  },
];

const ALL_MORE = MORE_GROUPS.flatMap((g) => g.links);

function isActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppHeader({ onOpenSettings, light }: { onOpenSettings?: () => void; light?: boolean }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // close the menu on navigation
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // close on outside click + Escape
  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  const moreActive = ALL_MORE.some((l) => (l.href === "/" ? pathname === "/" : isActive(l.href, pathname)));

  return (
    <header
      className={cn(
        "h-14 flex items-center justify-between px-5 border-b flex-shrink-0",
        light ? "border-black/10 bg-[#f4f1ea]" : "border-white/[0.06] bg-[var(--background)]",
      )}
    >
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5 group">
          <LogoMark size={22} className={light ? "text-black" : "text-white"} />
          <div className="flex flex-col leading-none">
            <span className={cn("text-[15px] font-semibold tracking-tight font-display", light ? "text-black" : "text-white")}>Sigda</span>
            <span className={cn("text-[9px] uppercase tracking-[0.18em] font-medium mt-0.5 hidden sm:block", light ? "text-black/45" : "text-white/40")}>
              the AI agent platform for Robinhood Chain
            </span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1 text-[13px]">
          {PRIMARY.map((l) => (
            <NavLink key={l.href} href={l.href} active={isActive(l.href, pathname)} light={light}>
              {l.label}
            </NavLink>
          ))}

          {/* More dropdown — the long tail, grouped */}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition-colors inline-flex items-center gap-1",
                light
                  ? moreActive || moreOpen ? "text-black bg-black/[0.06]" : "text-black/55 hover:text-black hover:bg-black/[0.04]"
                  : moreActive || moreOpen ? "text-white bg-white/[0.06]" : "text-white/55 hover:text-white hover:bg-white/[0.04]",
              )}
              aria-haspopup="true"
              aria-expanded={moreOpen}
            >
              More
              <ChevronDown className={cn("size-3.5 transition-transform", moreOpen && "rotate-180")} />
            </button>
            {moreOpen && (
              <div className={cn(
                "absolute right-0 top-full mt-2 z-50 w-[520px] rounded-xl shadow-2xl p-4 grid grid-cols-3 gap-4",
                light ? "border border-black/10 bg-[#f4f1ea] shadow-black/10" : "border border-white/10 bg-[#0b0d13] shadow-black/50",
              )}>
                {MORE_GROUPS.map((g) => (
                  <div key={g.title}>
                    <div className={cn("text-[10px] uppercase tracking-[0.16em] mb-2 px-1.5", light ? "text-black/40" : "text-white/35")}>{g.title}</div>
                    <div className="flex flex-col">
                      {g.links.map((l) => (
                        <Link
                          key={l.href}
                          href={l.href}
                          className={cn(
                            "px-2 py-1.5 rounded-md text-[13px] font-medium transition-colors",
                            light
                              ? isActive(l.href, pathname) ? "text-black bg-black/[0.06]" : "text-black/60 hover:text-black hover:bg-black/[0.04]"
                              : isActive(l.href, pathname) ? "text-white bg-white/[0.06]" : "text-white/60 hover:text-white hover:bg-white/[0.04]",
                          )}
                        >
                          {l.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </nav>
      </div>

      <div className="flex items-center gap-1.5">
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className={cn(
              "size-9 rounded-md flex items-center justify-center transition-colors",
              light ? "text-black/55 hover:text-black hover:bg-black/[0.05]" : "text-white/55 hover:text-white hover:bg-white/[0.05]",
            )}
            aria-label="Settings"
            title="Settings (Ctrl/Cmd + ,)"
          >
            <Settings className="size-4" />
          </button>
        )}
        <ConnectButton
          accountStatus={{ smallScreen: "avatar", largeScreen: "full" }}
          chainStatus={{ smallScreen: "icon", largeScreen: "icon" }}
          showBalance={false}
        />
      </div>
    </header>
  );
}

function NavLink({ href, active, light, children }: { href: string; active: boolean; light?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "px-2.5 py-1 rounded-md font-medium transition-colors",
        light
          ? active ? "text-black bg-black/[0.06]" : "text-black/55 hover:text-black hover:bg-black/[0.04]"
          : active ? "text-white bg-white/[0.06]" : "text-white/55 hover:text-white hover:bg-white/[0.04]",
      )}
    >
      {children}
    </Link>
  );
}
