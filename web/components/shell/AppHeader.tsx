"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Settings, ChevronDown } from "lucide-react";
import { LogoMark } from "@/components/ui/LogoMark";
import { cn } from "@/lib/cn";

// The story, up front. Everything else lives under "More".
const PRIMARY: { href: string; label: string }[] = [
  { href: "/spawn", label: "Spawn" },
  { href: "/aletheia", label: "Aletheia" },
  { href: "/vera", label: "VERA" },
  { href: "/network", label: "Network" },
  { href: "/docs", label: "Docs" },
  { href: "/os", label: "OS" },
  { href: "/brain", label: "Brain" },
  { href: "/bus", label: "Bus" },
  { href: "/swarm", label: "Swarm" },
  { href: "/capabilities", label: "Capabilities" },
  { href: "/x402", label: "x402" },
  { href: "/b20", label: "B20" },
  { href: "/autonomy", label: "Budgets" },
  { href: "/economy", label: "Economy" },
  { href: "/verified", label: "Verified" },
  { href: "/reputation", label: "Reputation" },
  { href: "/oracle", label: "Oracle" },
  { href: "/partners", label: "Partners" },
  { href: "/gate", label: "The Gate" },
];

const MORE_GROUPS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Build",
    links: [
      { href: "/marketplace", label: "Marketplace" },
      { href: "/pipelines", label: "Pipelines" },
      { href: "/frameworks", label: "Frameworks" },
      { href: "/nodes", label: "Nodes" },
      { href: "/syscalls", label: "Syscalls" },
      { href: "/council", label: "Council" },
      { href: "/radar", label: "Radar" },
    ],
  },
  {
    title: "Network",
    links: [
      { href: "/realtime", label: "Real-time" },
      { href: "/mini", label: "Mini App" },
      { href: "/feed", label: "Feed" },
      { href: "/rooms", label: "Rooms" },
      { href: "/launchpad", label: "Agents" },
      { href: "/launches", label: "Launches" },
      { href: "/bounties", label: "Bounties" },
      { href: "/sims", label: "Sims" },
      { href: "/agents/aeon", label: "Aeon" },
      { href: "/receipts", label: "Receipts" },
      { href: "/search", label: "Search" },
    ],
  },
  {
    title: "You",
    links: [
      { href: "/", label: "Chat" },
      { href: "/me", label: "Me" },
      { href: "/me/mentions", label: "Mentions" },
      { href: "/tokens", label: "Tokens" },
    ],
  },
];

const ALL_MORE = MORE_GROUPS.flatMap((g) => g.links);

function isActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppHeader({ onOpenSettings }: { onOpenSettings?: () => void }) {
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
    <header className="h-14 flex items-center justify-between px-5 border-b border-white/[0.06] bg-[var(--background)] flex-shrink-0">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5 group">
          <LogoMark size={22} className="text-white" />
          <div className="flex flex-col leading-none">
            <span className="text-[15px] font-semibold tracking-tight font-display">SIGNA</span>
            <span className="text-[9px] uppercase tracking-[0.18em] text-white/40 font-medium mt-0.5 hidden sm:block">
              the agent OS for Base
            </span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1 text-[13px]">
          {PRIMARY.map((l) => (
            <NavLink key={l.href} href={l.href} active={isActive(l.href, pathname)}>
              {l.label}
            </NavLink>
          ))}

          {/* More dropdown — the long tail, grouped */}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition-colors inline-flex items-center gap-1",
                moreActive || moreOpen ? "text-white bg-white/[0.06]" : "text-white/55 hover:text-white hover:bg-white/[0.04]",
              )}
              aria-haspopup="true"
              aria-expanded={moreOpen}
            >
              More
              <ChevronDown className={cn("size-3.5 transition-transform", moreOpen && "rotate-180")} />
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-full mt-2 z-50 w-[520px] rounded-xl border border-white/10 bg-[#0b0d13] shadow-2xl shadow-black/50 p-4 grid grid-cols-3 gap-4">
                {MORE_GROUPS.map((g) => (
                  <div key={g.title}>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-white/35 mb-2 px-1.5">{g.title}</div>
                    <div className="flex flex-col">
                      {g.links.map((l) => (
                        <Link
                          key={l.href}
                          href={l.href}
                          className={cn(
                            "px-2 py-1.5 rounded-md text-[13px] font-medium transition-colors",
                            isActive(l.href, pathname) ? "text-white bg-white/[0.06]" : "text-white/60 hover:text-white hover:bg-white/[0.04]",
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
            className="size-9 rounded-md flex items-center justify-center text-white/55 hover:text-white hover:bg-white/[0.05] transition-colors"
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

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "px-2.5 py-1 rounded-md font-medium transition-colors",
        active ? "text-white bg-white/[0.06]" : "text-white/55 hover:text-white hover:bg-white/[0.04]",
      )}
    >
      {children}
    </Link>
  );
}
