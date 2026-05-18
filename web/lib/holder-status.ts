import { createPublicClient, http, type Address } from "viem";
import { base } from "viem/chains";
import { ERC20_TRANSFER_ABI, TOKENS, type TokenInfo } from "./tokens";

// Server-side viem client for Base mainnet token balance reads.
// Public RPC is fine for low traffic; swap for a private RPC if rate-limited.
const baseClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL),
});

// Minimal balanceOf ABI (extending the transfer-only ABI in tokens.ts).
const BALANCE_OF_ABI = [
  ...ERC20_TRANSFER_ABI,
  {
    name: "balanceOf",
    type: "function" as const,
    stateMutability: "view" as const,
    inputs: [{ name: "account", type: "address" as const }],
    outputs: [{ name: "", type: "uint256" as const }],
  },
] as const;

export type HolderEntry = {
  symbol: string;
  project: string | null;
  /** smallest-unit (wei) balance */
  raw: string;
  /** human decimal string trimmed of trailing zeros */
  amount: string;
};

export type HolderStatus = {
  address: string;
  holdings: HolderEntry[]; // tokens with non-zero balance only
  /** number of distinct partner tokens held (non-USDC, non-ETH) */
  partnerCount: number;
  /** Eligibility: holds at least one partner token (BNKR / GITLAWB / MIROSHARK) */
  isEcosystemMember: boolean;
};

const PARTNER_SYMBOLS = new Set(["BNKR", "GITLAWB", "MIROSHARK"]);

// In-memory cache, 5-min TTL. Per-server-instance, ephemeral. Good enough
// for low traffic; replace with Redis/Supabase cache for scale.
type CacheEntry = { ts: number; data: HolderStatus };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getHolderStatus(rawAddress: string): Promise<HolderStatus> {
  const address = rawAddress.toLowerCase();
  const cached = cache.get(address);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  const tokens = TOKENS.filter((t) => t.address); // skip native ETH for now

  const balances = await Promise.all(
    tokens.map(async (t) =>
      readBalance(address as Address, t).catch(
        () => 0n as bigint,
      ),
    ),
  );

  const holdings: HolderEntry[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const raw = balances[i];
    if (raw <= 0n) continue;
    holdings.push({
      symbol: t.symbol,
      project: t.project ?? null,
      raw: raw.toString(),
      amount: formatRaw(raw, t.decimals),
    });
  }

  const partnerCount = holdings.filter((h) => PARTNER_SYMBOLS.has(h.symbol)).length;
  const status: HolderStatus = {
    address,
    holdings,
    partnerCount,
    isEcosystemMember: partnerCount >= 1,
  };
  cache.set(address, { ts: Date.now(), data: status });
  return status;
}

async function readBalance(
  address: Address,
  token: TokenInfo,
): Promise<bigint> {
  if (!token.address) return 0n;
  const result = (await baseClient.readContract({
    address: token.address,
    abi: BALANCE_OF_ABI,
    functionName: "balanceOf",
    args: [address],
  })) as bigint;
  return result;
}

function formatRaw(raw: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const frac = raw % base;
  if (frac === 0n) return `${whole}`;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  // keep at most 4 significant fractional chars for compactness
  return `${whole}.${fracStr.slice(0, 4)}`;
}

export function clearHolderCache() {
  cache.clear();
}
