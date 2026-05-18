import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import {
  ArrowLeft,
  MessageCircle,
  ArrowUpRight,
  ExternalLink,
} from "lucide-react";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";
import { PeerAvatar } from "@/components/ui/Avatar";
import { shortAddress } from "@/lib/format";
import { getToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

type Holder = {
  address: string;
  basename: string | null;
  ens_name: string | null;
  balance_raw: string;
  balance: string;
};

async function fetchHolders(symbol: string): Promise<{
  holders: Holder[];
  token?: {
    address: string;
    name: string;
    decimals: number;
    project: string | null;
    homepage: string | null;
  };
} | null> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("host") || "www.signaagent.xyz";
  try {
    const res = await fetch(`${proto}://${host}/api/holders/${symbol}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const j = await res.json();
    if (!j.ok) return null;
    return j as { holders: Holder[]; token: never };
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol: rawSym } = await params;
  const symbol = rawSym.toUpperCase();
  return {
    title: `$${symbol} holders on SIGNA`,
    description: `Every SIGNA user currently holding $${symbol}. Wallet-native, on-chain verified.`,
  };
}

export default async function HoldersPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol: rawSym } = await params;
  const symbol = rawSym.toUpperCase();

  const token = getToken(symbol);
  if (!token || !token.address) notFound();

  const data = await fetchHolders(symbol);
  const holders = data?.holders ?? [];

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1">
        <section className="border-b border-white/[0.06]">
          <div className="max-w-3xl mx-auto px-6 lg:px-10 pt-12 pb-10">
            <Link
              href="/directory"
              className="text-xs text-white/45 hover:text-white inline-flex items-center gap-1 mb-8"
            >
              <ArrowLeft className="size-3" />
              ../directory
            </Link>
            <div className="font-mono text-[11px] text-[var(--accent)] mb-4">
              $ signa holders ${symbol}
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-[-0.035em] leading-[1.02]">
              ${symbol} holders on SIGNA.
            </h1>
            <p className="text-white/65 max-w-lg mt-5 text-[15px] leading-relaxed">
              every SIGNA-registered wallet currently holding{" "}
              <span className="text-white">{token.name}</span> on @base.
              on-chain verified, sorted by balance. DM any of them with one
              click — your wallet is your identity.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {token.homepage && (
                <a
                  href={token.homepage}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[12px] text-white/55 hover:text-white inline-flex items-center gap-1.5 font-mono"
                >
                  <ExternalLink className="size-3" />
                  {token.project ?? symbol}
                </a>
              )}
              <a
                href={`https://basescan.org/token/${token.address}`}
                target="_blank"
                rel="noreferrer"
                className="text-[12px] text-white/55 hover:text-white inline-flex items-center gap-1.5 font-mono"
              >
                <ExternalLink className="size-3" />
                contract
              </a>
              <a
                href={`https://bankr.bot/agents/${token.address}`}
                target="_blank"
                rel="noreferrer"
                className="text-[12px] text-white/55 hover:text-white inline-flex items-center gap-1.5 font-mono"
              >
                <ExternalLink className="size-3" />
                trade on bankr
              </a>
            </div>
          </div>
        </section>

        <section className="flex-1">
          <div className="max-w-3xl mx-auto px-6 lg:px-10 py-10">
            {holders.length === 0 ? (
              <div className="border border-dashed border-white/15 px-6 py-10 font-mono text-[12px] text-white/55 max-w-xl">
                <div className="text-white/85 mb-2">{`>`} no SIGNA users hold ${symbol} yet.</div>
                <div className="text-white/40 mb-3">
                  {`>`} be first — buy on Bankr, then revisit this page.
                </div>
                <a
                  href={`https://bankr.bot/agents/${token.address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--accent)] hover:brightness-125 underline underline-offset-4"
                >
                  trade ${symbol} on bankr →
                </a>
              </div>
            ) : (
              <div className="border border-white/10 bg-black/30 font-mono text-[12px] leading-[1.7]">
                <div className="grid grid-cols-[40px_minmax(0,1fr)_120px_80px] gap-3 px-3 py-2 border-b border-white/10 text-white/40 uppercase tracking-wider text-[10px]">
                  <span>#</span>
                  <span>holder</span>
                  <span className="text-right">balance</span>
                  <span></span>
                </div>
                {holders.map((h, idx) => (
                  <HolderRow
                    key={h.address}
                    rank={idx + 1}
                    holder={h}
                    symbol={symbol}
                  />
                ))}
              </div>
            )}
            {holders.length > 0 && (
              <div className="mt-3 text-[11px] text-white/35 font-mono">
                {holders.length} holder{holders.length === 1 ? "" : "s"} ·
                scanned the most recent 500 registered SIGNA users · live
                on-chain balances
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function HolderRow({
  rank,
  holder,
  symbol,
}: {
  rank: number;
  holder: Holder;
  symbol: string;
}) {
  const display =
    holder.basename ??
    holder.ens_name ??
    shortAddress(holder.address, 6, 4);
  const handle = encodeURIComponent(
    holder.basename ?? holder.ens_name ?? holder.address,
  );

  return (
    <div className="grid grid-cols-[40px_minmax(0,1fr)_120px_80px] gap-3 px-3 py-2.5 border-b border-white/[0.05] last:border-b-0 hover:bg-white/[0.03] transition-colors items-center">
      <span
        className={`text-[12px] ${
          rank === 1
            ? "text-yellow-300"
            : rank === 2
              ? "text-white/85"
              : rank === 3
                ? "text-orange-300"
                : "text-white/40"
        }`}
      >
        {rank.toString().padStart(2, " ")}
      </span>
      <Link
        href={`/u/${handle}`}
        className="flex items-center gap-2.5 min-w-0 group"
      >
        <PeerAvatar address={holder.address} size={26} />
        <div className="min-w-0">
          <div className="text-[13px] text-white truncate group-hover:underline">
            {display}
          </div>
          <div className="text-[10px] font-mono text-white/35 truncate">
            {shortAddress(holder.address)}
          </div>
        </div>
      </Link>
      <div className="text-right">
        <span className="text-white font-medium tabular-nums">
          {holder.balance}
        </span>
        <span className="text-white/40 ml-1">${symbol}</span>
      </div>
      <Link
        href={`/dm/${handle}`}
        className="text-[10px] text-[var(--accent)] hover:brightness-125 inline-flex items-center gap-1 justify-end uppercase tracking-wider"
        title={`DM ${display}`}
      >
        <MessageCircle className="size-3" />
        DM
        <ArrowUpRight className="size-3" />
      </Link>
    </div>
  );
}
