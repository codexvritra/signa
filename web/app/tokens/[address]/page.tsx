import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import {
  ArrowLeft,
  ArrowUpRight,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";
import { formatUsd, formatPct, type TokenSummary } from "@/lib/geckoterminal";
import { shortAddress } from "@/lib/format";
import { getToken as getKnownToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

async function fetchToken(address: string): Promise<TokenSummary | null> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("host") || "www.signaagent.xyz";
  try {
    const res = await fetch(`${proto}://${host}/api/tokens/${address}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const j = (await res.json()) as TokenSummary & { ok: true };
    if (!j.ok) return null;
    return j;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address: raw } = await params;
  const t = await fetchToken(raw.toLowerCase());
  if (!t) {
    return { title: "Token · SIGNA" };
  }
  return {
    title: `$${t.symbol} on SIGNA`,
    description: `${t.name} on Base. Price ${formatUsd(t.price_usd)} · 24h ${formatPct(t.change_24h_pct)}. Discover + trade via SIGNA.`,
  };
}

export default async function TokenDetailPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address: raw } = await params;
  const address = raw.toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(address)) notFound();

  const t = await fetchToken(address);
  if (!t) notFound();

  // If this is one of our tracked partner tokens, show a link to its
  // SIGNA holders community page.
  const knownPartner = getKnownToken(t.symbol);
  const holdersHref =
    knownPartner?.project &&
    ["Bankr", "gitlawb", "MiroShark"].includes(knownPartner.project)
      ? `/holders/${t.symbol.toUpperCase()}`
      : null;

  const changeColor =
    t.change_24h_pct == null
      ? "text-white/40"
      : t.change_24h_pct >= 0
        ? "text-emerald-300"
        : "text-rose-300";

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1">
        <section className="border-b border-white/[0.06]">
          <div className="max-w-3xl mx-auto px-6 lg:px-10 pt-12 pb-10">
            <Link
              href="/tokens"
              className="text-xs text-white/45 hover:text-white inline-flex items-center gap-1 mb-8"
            >
              <ArrowLeft className="size-3" />
              ../tokens
            </Link>
            <div className="font-mono text-[11px] text-[var(--accent)] mb-4">
              $ signa token ${t.symbol || "?"} --network=base
            </div>
            <div className="flex items-start gap-4">
              {t.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.image_url}
                  alt={t.symbol}
                  width={56}
                  height={56}
                  className="rounded-full flex-shrink-0"
                />
              ) : (
                <span className="size-14 rounded-full bg-gradient-to-br from-violet-400/60 to-blue-400/60 flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-[-0.035em] leading-tight">
                  <span>${t.symbol || "?"}</span>
                  {t.name && (
                    <span className="text-white/55 text-2xl ml-2 font-normal">
                      {t.name}
                    </span>
                  )}
                </h1>
                <div className="text-[11px] font-mono text-white/40 mt-1.5 break-all">
                  {t.address}
                </div>
              </div>
              <a
                href={`https://bankr.bot/agents/${t.address}`}
                target="_blank"
                rel="noreferrer"
                className="bg-[var(--accent)] text-black font-semibold rounded-md px-5 py-2.5 text-[14px] uppercase tracking-wide inline-flex items-center gap-2 hover:brightness-110 transition flex-shrink-0"
              >
                Buy on Bankr
                <span aria-hidden className="font-mono">→</span>
              </a>
            </div>
          </div>
        </section>

        <section className="border-b border-white/[0.06]">
          <div className="max-w-3xl mx-auto px-6 lg:px-10 py-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Metric label="price" value={formatUsd(t.price_usd)} dot="bg-[var(--accent)]" />
              <Metric
                label="24h change"
                value={formatPct(t.change_24h_pct)}
                dot="bg-emerald-400"
                valueClass={changeColor}
              />
              <Metric
                label="24h volume"
                value={formatUsd(t.volume_24h_usd)}
                dot="bg-violet-400"
              />
              <Metric
                label="market cap"
                value={formatUsd(t.market_cap_usd ?? t.fdv_usd)}
                dot="bg-cyan-400"
              />
            </div>
          </div>
        </section>

        <section className="border-b border-white/[0.06]">
          <div className="max-w-3xl mx-auto px-6 lg:px-10 py-8">
            <div className="font-mono text-[11px] text-[var(--accent)] mb-3">
              $ signa links --token ${t.symbol || "?"}
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <LinkTile
                href={`https://basescan.org/token/${t.address}`}
                label="basescan contract"
                hint="verify ownership, holders, transfers"
                external
              />
              {t.top_pool_address && (
                <LinkTile
                  href={`https://www.geckoterminal.com/base/pools/${t.top_pool_address}`}
                  label="geckoterminal pool"
                  hint="depth chart, recent trades"
                  external
                />
              )}
              <LinkTile
                href={`https://bankr.bot/agents/${t.address}`}
                label="trade on bankr"
                hint="one-click swap via Bankr's terminal"
                external
              />
              {holdersHref && (
                <LinkTile
                  href={holdersHref}
                  label={`SIGNA holders of $${t.symbol}`}
                  hint="DM any of them by basename / ENS / 0x"
                />
              )}
            </div>
          </div>
        </section>

        <section className="border-b border-white/[0.06]">
          <div className="max-w-3xl mx-auto px-6 lg:px-10 py-8 flex flex-wrap items-center gap-3">
            <span className="font-mono text-[11px] text-white/45">
              # actions
            </span>
            <Link
              href={`/dm/${t.symbol ? `$${t.symbol}` : t.address}`}
              className="hidden"
              aria-hidden
            >
              {/* placeholder for future "DM about $TOKEN" group chat */}
            </Link>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                `tracking $${t.symbol} (${shortAddress(t.address, 6, 4)}) on @signaagent — ${formatUsd(t.price_usd)} · 24h ${formatPct(t.change_24h_pct)}\n\nhttps://www.signaagent.xyz/tokens/${t.address}`,
              )}`}
              target="_blank"
              rel="noreferrer"
              className="border border-white/15 text-white text-[12px] rounded-md px-3 py-1.5 inline-flex items-center gap-1.5 hover:bg-white/[0.04] transition"
            >
              Share on X
              <ArrowUpRight className="size-3" />
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function Metric({
  label,
  value,
  dot,
  valueClass,
}: {
  label: string;
  value: string;
  dot: string;
  valueClass?: string;
}) {
  return (
    <div className="border border-white/10 px-3 py-3 bg-black/30">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={`size-1.5 rounded-full ${dot}`} />
        <span className="text-[10px] uppercase tracking-wider text-white/45 font-mono">
          {label}
        </span>
      </div>
      <div className={`text-[18px] font-display tabular-nums tracking-tight ${valueClass ?? "text-white"}`}>
        {value}
      </div>
    </div>
  );
}

function LinkTile({
  href,
  label,
  hint,
  external,
}: {
  href: string;
  label: string;
  hint: string;
  external?: boolean;
}) {
  const Tag = external ? "a" : Link;
  const props = external
    ? { href, target: "_blank", rel: "noreferrer" }
    : { href };
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Tag
      {...(props as any)}
      className="border border-white/10 px-3 py-3 hover:bg-white/[0.03] transition group flex items-start gap-2"
    >
      <ExternalLink className="size-3 text-white/30 mt-1 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-white truncate group-hover:underline">
          {label}
        </div>
        <div className="text-[11px] text-white/45 leading-snug mt-0.5">
          {hint}
        </div>
      </div>
    </Tag>
  );
}
