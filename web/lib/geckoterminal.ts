/**
 * Thin client for GeckoTerminal's public API.
 *
 * GeckoTerminal exposes structured Base mainnet token + pool data
 * free and no-key. This is the same data source Bankr routes to
 * internally when you ask it about prices — we go direct so SIGNA's
 * discovery surface doesn't depend on Bankr's natural-language
 * prompt round-trip.
 *
 * Docs: https://api.geckoterminal.com/docs
 *
 * Cached 60 s per endpoint in-process so a busy /tokens page doesn't
 * hammer their rate limit (~30/min).
 */

const GT = "https://api.geckoterminal.com/api/v2";
const TTL_MS = 60_000;

type CacheEntry<T> = { ts: number; data: T };
const cache = new Map<string, CacheEntry<unknown>>();

async function getCached<T>(key: string, fetcher: () => Promise<T>): Promise<T | null> {
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.data;
  try {
    const data = await fetcher();
    cache.set(key, { ts: Date.now(), data });
    return data;
  } catch (e) {
    console.error(`[geckoterminal] ${key} failed:`, e instanceof Error ? e.message : e);
    return null;
  }
}

export type TokenSummary = {
  /** lowercase 0x address */
  address: string;
  symbol: string;
  name: string;
  /** USD price */
  price_usd: string;
  /** USD volume in last 24h */
  volume_24h_usd: string;
  /** USD market cap */
  market_cap_usd: string | null;
  fdv_usd: string | null;
  /** percent change in last 24h, -100..+inf */
  change_24h_pct: number | null;
  /** GeckoTerminal pool address (top liquidity) — useful for swap routing later */
  top_pool_address: string | null;
  image_url: string | null;
};

type GtTokenAttrs = {
  address: string;
  name: string;
  symbol: string;
  image_url?: string;
  price_usd?: string;
  fdv_usd?: string;
  market_cap_usd?: string;
  volume_usd?: { h24?: string };
  // Some endpoints embed price change here; others omit it
  price_change_percentage?: { h24?: string };
};

type GtPoolAttrs = {
  address: string;
  name: string;
  base_token_price_usd?: string;
  quote_token_price_usd?: string;
  price_change_percentage?: { h24?: string };
  volume_usd?: { h24?: string };
  market_cap_usd?: string;
  fdv_usd?: string;
};

type GtPoolRel = {
  base_token?: { data?: { id?: string } };
};

function poolToToken(pool: {
  attributes: GtPoolAttrs;
  relationships?: GtPoolRel;
}): TokenSummary | null {
  const baseTokenId = pool.relationships?.base_token?.data?.id;
  if (!baseTokenId) return null;
  // baseTokenId is "base_<address>" — strip the chain prefix
  const addr = baseTokenId.replace(/^base_/, "").toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(addr)) return null;
  return {
    address: addr,
    // We'll fill name+symbol from the included tokens block on the caller side
    symbol: "",
    name: pool.attributes.name?.split(" / ")[0] ?? "",
    price_usd: pool.attributes.base_token_price_usd ?? "0",
    volume_24h_usd: pool.attributes.volume_usd?.h24 ?? "0",
    market_cap_usd: pool.attributes.market_cap_usd ?? null,
    fdv_usd: pool.attributes.fdv_usd ?? null,
    change_24h_pct: pool.attributes.price_change_percentage?.h24
      ? Number(pool.attributes.price_change_percentage.h24)
      : null,
    top_pool_address: pool.attributes.address.toLowerCase(),
    image_url: null,
  };
}

/** GeckoTerminal returns trending POOLS, not trending tokens directly. We
 * extract the base token of each top pool. */
export async function trendingTokensOnBase(limit = 20): Promise<TokenSummary[]> {
  const data = await getCached(`trending-${limit}`, async () => {
    const url = `${GT}/networks/base/trending_pools?include=base_token&page=1`;
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store" as RequestCache,
    });
    if (!res.ok) throw new Error(`GT trending HTTP ${res.status}`);
    return (await res.json()) as {
      data: Array<{
        attributes: GtPoolAttrs;
        relationships?: GtPoolRel;
      }>;
      included?: Array<{ id: string; attributes: GtTokenAttrs }>;
    };
  });
  if (!data) return [];

  // Map included tokens by id for symbol/name enrichment.
  const includedById = new Map<string, GtTokenAttrs>();
  for (const inc of data.included ?? []) {
    includedById.set(inc.id, inc.attributes);
  }

  const out: TokenSummary[] = [];
  const seen = new Set<string>();
  for (const pool of data.data) {
    const t = poolToToken(pool);
    if (!t) continue;
    if (seen.has(t.address)) continue;
    seen.add(t.address);
    const baseId = pool.relationships?.base_token?.data?.id;
    if (baseId) {
      const incl = includedById.get(baseId);
      if (incl) {
        t.symbol = incl.symbol ?? t.symbol;
        t.name = incl.name ?? t.name;
        t.image_url = incl.image_url ?? null;
      }
    }
    out.push(t);
    if (out.length >= limit) break;
  }
  return out;
}

/** Recently created Base pools — gateway to "new token launches". */
export async function newPoolsOnBase(limit = 20): Promise<TokenSummary[]> {
  const data = await getCached(`new-${limit}`, async () => {
    const url = `${GT}/networks/base/new_pools?include=base_token&page=1`;
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store" as RequestCache,
    });
    if (!res.ok) throw new Error(`GT new HTTP ${res.status}`);
    return (await res.json()) as {
      data: Array<{
        attributes: GtPoolAttrs;
        relationships?: GtPoolRel;
      }>;
      included?: Array<{ id: string; attributes: GtTokenAttrs }>;
    };
  });
  if (!data) return [];
  const includedById = new Map<string, GtTokenAttrs>();
  for (const inc of data.included ?? []) {
    includedById.set(inc.id, inc.attributes);
  }
  const out: TokenSummary[] = [];
  const seen = new Set<string>();
  for (const pool of data.data) {
    const t = poolToToken(pool);
    if (!t) continue;
    if (seen.has(t.address)) continue;
    seen.add(t.address);
    const baseId = pool.relationships?.base_token?.data?.id;
    if (baseId) {
      const incl = includedById.get(baseId);
      if (incl) {
        t.symbol = incl.symbol ?? t.symbol;
        t.name = incl.name ?? t.name;
        t.image_url = incl.image_url ?? null;
      }
    }
    out.push(t);
    if (out.length >= limit) break;
  }
  return out;
}

/** Single-token detail by Base address — for /tokens/[address] pages. */
export async function tokenOnBase(address: string): Promise<TokenSummary | null> {
  const addr = address.toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(addr)) return null;
  return getCached(`token-${addr}`, async () => {
    // GT token endpoint includes top_pools, which is what we need for
    // price + volume. /tokens/{address} alone doesn't have volume.
    const url = `${GT}/networks/base/tokens/${addr}?include=top_pools`;
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store" as RequestCache,
    });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`GT token HTTP ${res.status}`);
    }
    const j = (await res.json()) as {
      data: { attributes: GtTokenAttrs; relationships?: { top_pools?: { data?: Array<{ id: string }> } } };
      included?: Array<{ id: string; type: string; attributes: GtPoolAttrs }>;
    };
    const t = j.data.attributes;
    const topPoolId = j.data.relationships?.top_pools?.data?.[0]?.id;
    const topPool = (j.included ?? []).find((i) => i.type === "pool" && i.id === topPoolId);

    const summary: TokenSummary = {
      address: addr,
      symbol: t.symbol ?? "",
      name: t.name ?? "",
      price_usd: t.price_usd ?? topPool?.attributes.base_token_price_usd ?? "0",
      volume_24h_usd:
        t.volume_usd?.h24 ?? topPool?.attributes.volume_usd?.h24 ?? "0",
      market_cap_usd: t.market_cap_usd ?? topPool?.attributes.market_cap_usd ?? null,
      fdv_usd: t.fdv_usd ?? topPool?.attributes.fdv_usd ?? null,
      change_24h_pct: topPool?.attributes.price_change_percentage?.h24
        ? Number(topPool.attributes.price_change_percentage.h24)
        : null,
      top_pool_address: topPool?.attributes.address.toLowerCase() ?? null,
      image_url: t.image_url ?? null,
    };
    return summary;
  });
}

/** Format a USD value into a short tag-friendly string. */
export function formatUsd(raw: string | number | null | undefined): string {
  const n = typeof raw === "number" ? raw : Number(raw ?? 0);
  if (!Number.isFinite(n) || n === 0) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}k`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  return `$${n.toExponential(2)}`;
}

export function formatPct(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return "—";
  const sign = p >= 0 ? "+" : "";
  return `${sign}${p.toFixed(2)}%`;
}
