"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Settings, ChevronDown, Check, Copy } from "lucide-react";
import { LogoMark } from "@/components/ui/LogoMark";
import { cn } from "@/lib/cn";

const SIGDA_CA = "0x1fb373d6f16380972212b9106eb032fa517de447";
const SIGDA_X_URL = "https://x.com/SIGDA_AI";
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function CaPill({ mono }: { mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(SIGDA_CA).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };
  return (
    <button
      onClick={copy}
      title={SIGDA_CA}
      className={cn(
        "hidden sm:inline-flex items-center gap-1.5 shrink-0 transition-colors font-mono text-[11px]",
        mono
          ? "px-2 py-1 border border-[#262626] text-[#8a8a86] hover:text-[#e8e8e6] hover:border-[#383838]"
          : "px-2.5 py-1 rounded-md border border-white/10 text-white/55 hover:text-white hover:bg-white/[0.05]",
      )}
    >
      <span className="uppercase tracking-wide opacity-70">CA</span>
      <span>{short(SIGDA_CA)}</span>
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
    </button>
  );
}

// The homepage itself now explains and embeds the whole product (launch,
// live agents, activity feed) — the nav only needs the one action (Launch)
// and the one dev on-ramp (Docs). Everything else lives under "More".
const PRIMARY: { href: string; label: string }[] = [
  { href: "/launch", label: "Launch" },
  { href: "/docs", label: "Docs" },
];

const MORE_GROUPS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Agents & AI",
    links: [
      { href: "/launches", label: "Live agents" },
      { href: "/launches/live", label: "Activity feed" },
      { href: "/economy", label: "Economy" },
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

  // `light` now means the 9e9.world-style dark/mono surface used by the
  // public product pages (home, board, launch, launches, live, economy) —
  // near-black, monospace, flat hairline borders, slash-style nav. Pages
  // that don't pass `light` keep the original dark-glass header untouched.
  if (light) {
    return (
      <header className="h-14 flex items-center justify-between px-5 md:px-8 border-b border-[#262626] bg-[#111111]/95 backdrop-blur-sm flex-shrink-0 font-mono">
        <Link href="/" className="text-[17px] font-bold tracking-tight shrink-0">
          <span className="text-[#8a8a86]">sig</span>
          <span className="text-[#e8e8e6]">da</span>
        </Link>

        <nav className="hidden md:flex items-center gap-5 text-[13px] mx-6">
          {PRIMARY.map((l) => (
            <MonoNavLink key={l.href} href={l.href} active={isActive(l.href, pathname)}>
              {l.label}
            </MonoNavLink>
          ))}

          {/* More dropdown — the long tail, grouped */}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1 transition-colors",
                moreActive || moreOpen ? "text-[#e8e8e6]" : "text-[#8a8a86] hover:text-[#e8e8e6]",
              )}
              aria-haspopup="true"
              aria-expanded={moreOpen}
            >
              /more
              <ChevronDown className={cn("size-3 transition-transform", moreOpen && "rotate-180")} />
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-full mt-3 z-50 w-[560px] border border-[#262626] bg-[#111111] p-4 grid grid-cols-3 gap-4">
                {MORE_GROUPS.map((g) => (
                  <div key={g.title}>
                    <div className="text-[10px] uppercase tracking-[0.16em] mb-2 px-1.5 text-[#5a5a57]">{g.title}</div>
                    <div className="flex flex-col">
                      {g.links.map((l) => (
                        <Link
                          key={l.href}
                          href={l.href}
                          className={cn(
                            "px-1.5 py-1 text-[13px] transition-colors",
                            isActive(l.href, pathname) ? "text-[#e8e8e6]" : "text-[#8a8a86] hover:text-[#e8e8e6]",
                          )}
                        >
                          /{l.label.toLowerCase().replace(/\s+/g, "-")}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <CaPill mono />
          <a
            href={SIGDA_X_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="size-7 flex items-center justify-center text-[#8a8a86] hover:text-[#e8e8e6] transition-colors"
            aria-label="Sigda on X"
            title="@SIGDA_AI on X"
          >
            <XIcon className="size-3.5" />
          </a>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="size-7 flex items-center justify-center text-[#8a8a86] hover:text-[#e8e8e6] transition-colors"
              aria-label="Settings"
              title="Settings (Ctrl/Cmd + ,)"
            >
              <Settings className="size-3.5" />
            </button>
          )}
          {/* Full RainbowKit ConnectButton kept as-is (same component + props as the
              dark-glass header) — its own darkTheme (white pill, black text, small
              radius; see app/providers.tsx) already reads fine on this near-black
              header, and re-skinning it risks breaking the chain-switch/account
              modal flow. */}
          <ConnectButton
            accountStatus={{ smallScreen: "avatar", largeScreen: "avatar" }}
            chainStatus={{ smallScreen: "icon", largeScreen: "icon" }}
            showBalance={false}
          />
        </div>
      </header>
    );
  }

  return (
    <header className="h-14 flex items-center justify-between px-5 border-b border-white/[0.06] bg-[var(--background)] flex-shrink-0">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5 group">
          <LogoMark size={22} className="text-white" />
          <div className="flex flex-col leading-none">
            <span className="text-[15px] font-semibold tracking-tight font-display text-white">Sigda</span>
            <span className="text-[9px] uppercase tracking-[0.18em] font-medium mt-0.5 hidden sm:block text-white/40">
              the AI agent platform for Robinhood Chain
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
              <div className="absolute right-0 top-full mt-2 z-50 w-[520px] rounded-xl shadow-2xl p-4 grid grid-cols-3 gap-4 border border-white/10 bg-[#0b0d13] shadow-black/50">
                {MORE_GROUPS.map((g) => (
                  <div key={g.title}>
                    <div className="text-[10px] uppercase tracking-[0.16em] mb-2 px-1.5 text-white/35">{g.title}</div>
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
        <CaPill />
        <a
          href={SIGDA_X_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="size-9 rounded-md flex items-center justify-center transition-colors text-white/55 hover:text-white hover:bg-white/[0.05]"
          aria-label="Sigda on X"
          title="@SIGDA_AI on X"
        >
          <XIcon className="size-4" />
        </a>
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="size-9 rounded-md flex items-center justify-center transition-colors text-white/55 hover:text-white hover:bg-white/[0.05]"
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

function MonoNavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn("transition-colors", active ? "text-[#e8e8e6]" : "text-[#8a8a86] hover:text-[#e8e8e6]")}
    >
      /{String(children).toLowerCase()}
    </Link>
  );
}
