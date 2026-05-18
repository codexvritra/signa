/**
 * Portfolio valuation — given a wallet address, read on-chain ERC-20
 * balances for a known universe of tokens, fetch each one's USD price
 * via GeckoTerminal, and return a fully-typed Position[] sorted by
 * USD value desc.
 *
 * The "universe" is the union of:
 *   - Our tracked tokens in lib/tokens.ts (ETH, USDC, BNKR, GITLAWB,
 *     MIROSHARK)
 *   - The user's watchlist (their bookmarked tokens) — passed in by
 *     the caller from localStorage on the client OR a watchlist table
 *     server-side
 *
 * Cached 60 s in-process per wallet so /me renders fast on revisit.
 */

import { createPublicClient, http, type Address } from "viem";
import { base } from "viem/chains";
import { TOKENS, type TokenInfo } from "./tokens";
import { tokenOnBase, formatUsd, type TokenSummary } from "./geckoterminal";

const BASE_RPC = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const baseClient = createPublicClient({
  chain: base,
  transport: http(BASE_RPC),
});

const BALANCE_OF_ABI = [
  {
    name: "balanceOf",
    type: "function" as const,
    stateMutability: "view" as const,
    inputs: [{ name: "owner", type: "address" as const }],
    outputs: [{ name: "balance", type: "uint256" as const }],
  },
] as const;

export type Position = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  /** raw balance as decimal string */
  balance: string;
  /** USD price per unit */
  price_usd: number;
  /** USD value of the position */
  value_usd: number;
  /** 24h change pct, may be null */
  change_24h_pct: number | null;
  image_url: string | null;
  /** "ETH" for native, "ERC20" for tokens */
  kind: "ETH" | "ERC20";
  /** whether this token came from the user's watchlist (vs tracked partner set) */
  source: "tracked" | "watchlist";
};

export type PortfolioSnapshot = {
  address: string;
  positions: Position[];
  total_usd: number;
  /** combined 24h change in USD, computed from per-position values + change pct */
  change_24h_usd: number;
  change_24h_pct: number;
  fetched_at: string;
};

type CacheEntry = { ts: number; data: PortfolioSnapshot };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 60_000;

function rawToDecimal(raw: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const frac = raw % base;
  if (frac === 0n) return `${whole}`;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fracStr.slice(0, 6)}`;
}

function decimalToNumber(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

async function readBalance(
  address: Address,
  token: TokenInfo,
): Promise<bigint> {
  if (!token.address) {
    // native ETH
    try {
      return await baseClient.getBalance({ address });
    } catch {
      return 0n;
    }
  }
  try {
    const b = (await baseClient.readContract({
      address: token.address,
      abi: BALANCE_OF_ABI,
      functionName: "balanceOf",
      args: [address],
    })) as bigint;
    return b;
  } catch {
    return 0n;
  }
}

export async function getPortfolio(
  rawAddress: string,
  watchlistAddresses: string[] = [],
): Promise<PortfolioSnapshot> {
  const address = rawAddress.toLowerCase();
  const cacheKey = `${address}|${watchlistAddresses.sort().join(",")}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.data;

  // 1. Build the universe of tokens to check
  const watchlistInfos: TokenInfo[] = [];
  for (const watchAddr of watchlistAddresses) {
    const lower = watchAddr.toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(lower)) continue;
    // skip if already in TOKENS
    if (TOKENS.some((t) => t.address?.toLowerCase() === lower)) continue;
    // We'll fetch metadata + price from GeckoTerminal during pricing.
    watchlistInfos.push({
      symbol: "?",
      name: "Watchlisted",
      address: lower as Address,
      decimals: 18, // assume 18 — corrected if GT returns a different value
      presets: [],
    });
  }
  const universe: Array<TokenInfo & { source: "tracked" | "watchlist" }> = [
    ...TOKENS.map((t) => ({ ...t, source: "tracked" as const })),
    ...watchlistInfos.map((t) => ({ ...t, source: "watchlist" as const })),
  ];

  // 2. Read balances in parallel
  const balances = await Promise.all(
    universe.map((t) => readBalance(address as Address, t)),
  );

  // 3. Filter to non-zero positions and price each via GeckoTerminal
  const positions: Position[] = [];
  await Promise.all(
    universe.map(async (t, i) => {
      const raw = balances[i];
      if (raw <= 0n) return;
      const balanceStr = rawToDecimal(raw, t.decimals);
      const balanceNum = decimalToNumber(balanceStr);

      // ETH gets priced via the WETH pool on GeckoTerminal — we use a
      // hardcoded WETH address on Base.
      const priceAddress = t.address
        ? t.address.toLowerCase()
        : "0x4200000000000000000000000000000000000006"; // WETH on Base

      let info: TokenSummary | null = null;
      try {
        info = await tokenOnBase(priceAddress);
      } catch {
        // ok — falls through to 0
      }

      const price = info ? decimalToNumber(info.price_usd) : 0;
      const value = balanceNum * price;
      positions.push({
        address: t.address?.toLowerCase() ?? priceAddress,
        symbol: info?.symbol || t.symbol,
        name: info?.name || t.name,
        decimals: t.decimals,
        balance: balanceStr,
        price_usd: price,
        value_usd: value,
        change_24h_pct: info?.change_24h_pct ?? null,
        image_url: info?.image_url ?? null,
        kind: t.address ? "ERC20" : "ETH",
        source: t.source,
      });
    }),
  );

  // 4. Sort by value desc
  positions.sort((a, b) => b.value_usd - a.value_usd);

  const total_usd = positions.reduce((acc, p) => acc + p.value_usd, 0);
  const change_24h_usd = positions.reduce((acc, p) => {
    if (p.change_24h_pct == null) return acc;
    // current value / (1 + pct/100) = prev value; delta = current - prev
    const prev = p.value_usd / (1 + p.change_24h_pct / 100);
    return acc + (p.value_usd - prev);
  }, 0);
  const change_24h_pct =
    total_usd - change_24h_usd > 0
      ? (change_24h_usd / (total_usd - change_24h_usd)) * 100
      : 0;

  const snap: PortfolioSnapshot = {
    address,
    positions,
    total_usd,
    change_24h_usd,
    change_24h_pct,
    fetched_at: new Date().toISOString(),
  };
  cache.set(cacheKey, { ts: Date.now(), data: snap });
  return snap;
}

export { formatUsd };
