import Link from "next/link";
import { headers } from "next/headers";
import { ArrowLeft, ArrowUpRight, ExternalLink, Sparkles } from "lucide-react";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";
import { formatUsd, formatPct, type TokenSummary } from "@/lib/geckoterminal";
import { TokensTabs } from "./TokensTabs";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tokens on Base · SIGNA",
  description:
    "Trending and recently launched tokens on Base mainnet. Discovery powered by GeckoTerminal, trading via Bankr.",
};

async function fetchTokens(kind: "trending" | "new"): Promise<TokenSummary[]> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("host") || "www.signaagent.xyz";
  try {
    const res = await fetch(
      `${proto}://${host}/api/tokens/trending?kind=${kind}`,
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    const j = (await res.json()) as { tokens: TokenSummary[] };
    return j.tokens ?? [];
  } catch {
    return [];
  }
}

export default async function TokensPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const tab: "trending" | "new" = sp.tab === "new" ? "new" : "trending";
  const tokens = await fetchTokens(tab);

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1">
        <section className="border-b border-white/[0.06]">
          <div className="max-w-4xl mx-auto px-6 lg:px-10 pt-12 pb-10">
            <Link
              href="/"
              className="text-xs text-white/45 hover:text-white inline-flex items-center gap-1 mb-8"
            >
              <ArrowLeft className="size-3" />
              ..
            </Link>
            <div className="font-mono text-[11px] text-[var(--accent)] mb-4">
              $ signa tokens --network=base
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-[-0.035em] leading-[1.02]">
              Tokens on Base.
            </h1>
            <p className="text-white/65 max-w-xl mt-5 text-[15px] leading-relaxed">
              live discovery surface for every ERC-20 on Base. trending
              from GeckoTerminal (the same source Bankr routes to
              internally), recent launches, search any address. click a
              token to see its pool, holders, the feed talking about it,
              and one-click trade via @bankrbot.
            </p>
            <div className="mt-6">
              <TokensTabs current={tab} />
            </div>
          </div>
        </section>

        <section className="flex-1">
          <div className="max-w-4xl mx-auto px-6 lg:px-10 py-8">
            {tokens.length === 0 ? (
              <div className="border border-dashed border-white/15 px-6 py-10 font-mono text-[12px] text-white/55">
                <div className="text-white/85 mb-2">
                  {`>`} GeckoTerminal returned no {tab} tokens.
                </div>
                <div className="text-white/40">
                  {`>`} cached 60s — try again in a moment.
                </div>
              </div>
            ) : (
              <div className="border border-white/10 bg-black/30 font-mono text-[12px] leading-[1.7]">
                <div className="grid grid-cols-[40px_minmax(0,1fr)_100px_110px_120px_70px] gap-3 px-3 py-2 border-b border-white/10 text-white/40 uppercase tracking-wider text-[10px]">
                  <span>#</span>
                  <span>token</span>
                  <span className="text-right">price</span>
                  <span className="text-right">24h</span>
                  <span className="text-right">volume 24h</span>
                  <span></span>
                </div>
                {tokens.map((t, idx) => (
                  <TokenRow key={t.address} rank={idx + 1} token={t} />
                ))}
              </div>
            )}
            <div className="mt-3 text-[11px] text-white/35 font-mono">
              source: api.geckoterminal.com · cached 60s · trade exec via
              bankr.bot
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function TokenRow({ rank, token }: { rank: number; token: TokenSummary }) {
  const change = token.change_24h_pct;
  const changeColor =
    change == null
      ? "text-white/40"
      : change >= 0
        ? "text-emerald-300"
        : "text-rose-300";
  return (
    <div className="grid grid-cols-[40px_minmax(0,1fr)_100px_110px_120px_70px] gap-3 px-3 py-2.5 border-b border-white/[0.05] last:border-b-0 hover:bg-white/[0.03] transition-colors items-center">
      <span className="text-[12px] text-white/40">
        {rank.toString().padStart(2, " ")}
      </span>
      <Link
        href={`/tokens/${token.address}`}
        className="flex items-center gap-2 min-w-0 group"
      >
        {token.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={token.image_url}
            alt={token.symbol}
            width={24}
            height={24}
            className="rounded-full flex-shrink-0"
          />
        ) : (
          <span className="size-6 rounded-full bg-gradient-to-br from-violet-400/60 to-blue-400/60 flex-shrink-0" />
        )}
        <div className="min-w-0">
          <div className="text-[13px] text-white truncate group-hover:underline">
            <span className="font-medium">${token.symbol || "?"}</span>
            {token.name && (
              <span className="text-white/45 ml-1">· {token.name}</span>
            )}
          </div>
          <div className="text-[10px] text-white/35 font-mono truncate">
            {token.address.slice(0, 10)}…{token.address.slice(-4)}
          </div>
        </div>
      </Link>
      <div className="text-right text-white tabular-nums">
        {formatUsd(token.price_usd)}
      </div>
      <div className={`text-right tabular-nums ${changeColor}`}>
        {formatPct(token.change_24h_pct)}
      </div>
      <div className="text-right text-white/70 tabular-nums">
        {formatUsd(token.volume_24h_usd)}
      </div>
      <a
        href={`https://bankr.bot/agents/${token.address}`}
        target="_blank"
        rel="noreferrer"
        className="text-[var(--accent)] hover:brightness-125 inline-flex items-center justify-end gap-1 text-[11px] uppercase tracking-wide font-mono"
        title={`Trade $${token.symbol} on Bankr`}
      >
        Buy
        <ArrowUpRight className="size-3" />
      </a>
    </div>
  );
}
