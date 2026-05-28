"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Live receipts banner shown on the public landing page.
 *
 * Fetches /api/receipts every 30s and animates the totals (rooms,
 * signed messages, unique signers) so visitors land on real numbers
 * that update in front of them. Built defensively — if the API is
 * down or returns 0, the banner stays hidden so we don't show a row
 * of zeroes on a fresh node.
 */
interface ReceiptsTotals {
  rooms: number;
  rooms_7d: number;
  messages: number;
  messages_7d: number;
  unique_posters: number;
}

const POLL_MS = 30_000;

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function LiveReceiptsBanner() {
  const [totals, setTotals] = useState<ReceiptsTotals | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch("/api/receipts", { cache: "no-store" });
        const d = await r.json().catch(() => ({}));
        if (cancelled || !d?.ok) return;
        setTotals(d.totals ?? null);
        setLastUpdated(Date.now());
      } catch {
        // ignore — banner stays hidden
      }
    }
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Defensive: hide on cold state or when no signed traffic.
  if (!totals || totals.messages === 0) return null;

  return (
    <section className="border-y border-white/[0.06] bg-black/30">
      <div className="max-w-6xl mx-auto px-6 lg:px-10 py-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <span
              className="size-1.5 rounded-full bg-emerald-400"
              style={{
                boxShadow: "0 0 6px rgba(110,231,183,0.85)",
                animation: "pulse 2.6s ease-in-out infinite",
              }}
              aria-hidden
            />
            <span className="text-[10px] uppercase tracking-[0.18em] text-emerald-300/90 font-mono">
              live receipts · base mainnet
            </span>
            {lastUpdated && (
              <span className="text-[10px] font-mono text-white/30 ml-2">
                · refreshed{" "}
                {Math.max(0, Math.round((Date.now() - lastUpdated) / 1000))}s ago
              </span>
            )}
          </div>
          <Link
            href="/receipts"
            className="text-[11.5px] font-mono uppercase tracking-wider text-white/45 hover:text-white"
          >
            view ledger →
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-6">
          <Stat
            label="wallet-signed rooms"
            value={fmt(totals.rooms)}
            sub={`${fmt(totals.rooms_7d)} this week`}
          />
          <Stat
            label="signed messages"
            value={fmt(totals.messages)}
            sub={`${fmt(totals.messages_7d)} this week`}
          />
          <Stat
            label="unique signers"
            value={fmt(totals.unique_posters)}
            sub="EIP-191 wallets"
          />
        </div>
      </div>
      <style jsx>{`
        @keyframes pulse {
          0%,
          100% {
            opacity: 0.55;
            transform: scale(0.85);
          }
          50% {
            opacity: 1;
            transform: scale(1.15);
          }
        }
      `}</style>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div>
      <div className="font-display text-3xl sm:text-4xl font-medium tracking-[-0.02em] tabular-nums text-white leading-none">
        {value}
      </div>
      <div className="mt-2 text-[10.5px] uppercase tracking-[0.16em] text-white/45">
        {label}
      </div>
      <div className="mt-0.5 text-[10.5px] font-mono text-white/30">{sub}</div>
    </div>
  );
}
