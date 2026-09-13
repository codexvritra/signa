import type { Address } from "viem";

export type TokenInfo = {
  symbol: string;
  name: string;
  /** null = native asset (ETH). otherwise ERC-20 contract address. */
  address: Address | null;
  decimals: number;
  /** Default quick-pick amounts shown in PaymentModal. */
  presets: string[];
  /** Where this token lives in the ecosystem (for amplification copy). */
  project?: string;
  homepage?: string;
  /**
   * Which chain this token's contract actually lives on. SIGDA itself runs
   * on Robinhood Chain, but MIROSHARK is a real third-party community token
   * deployed on Base — it isn't SIGDA infra, so it stays reachable on the
   * chain it actually exists on rather than being mislabeled or dropped.
   * Defaults to "robinhood" when omitted.
   */
  chain?: "robinhood" | "base";
};

/**
 * Featured tokens for in-chat tipping.
 * - ETH: native gas + universal tip (works on any EVM chain incl. Robinhood Chain)
 * - USDG: Robinhood Chain's native stablecoin (Paxos Global Dollar)
 * - MIROSHARK: ecosystem amplification — the community has a reason to
 *   mention SIGDA when they can tip in their token. A real external
 *   community token that lives on Base; SIGDA reads its balance there
 *   regardless of which chain SIGDA itself runs on.
 */
export const TOKENS: TokenInfo[] = [
  {
    symbol: "ETH",
    name: "Ether",
    address: null,
    decimals: 18,
    presets: ["0.001", "0.005", "0.01", "0.05"],
  },
  {
    symbol: "USDG",
    name: "Global Dollar",
    address: "0x5fc5360d0400a0fd4f2af552add042d716f1d168",
    decimals: 6,
    presets: ["1", "5", "10", "25"],
    project: "Paxos",
    homepage: "https://www.globaldollar.com",
  },
  {
    // On-chain symbol returned by contract: "MiroShark" (per eth_call to 0x95d89b41).
    // We expose it in upper-case "MIROSHARK" for chip-style visual consistency.
    symbol: "MIROSHARK",
    name: "MiroShark",
    address: "0xd7bc6a05a56655fb2052f742b012d1dfd66e1ba3",
    decimals: 18,
    presets: ["10", "50", "100", "500"],
    project: "MiroShark",
    homepage: "https://github.com/aaronjmars/MiroShark",
    chain: "base",
  },
];

export function getToken(symbol: string): TokenInfo | undefined {
  return TOKENS.find((t) => t.symbol.toLowerCase() === symbol.toLowerCase());
}

export const ERC20_TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function" as const,
    stateMutability: "nonpayable" as const,
    inputs: [
      { name: "to", type: "address" as const },
      { name: "amount", type: "uint256" as const },
    ],
    outputs: [{ name: "", type: "bool" as const }],
  },
] as const;

/** Parse a decimal user input into the token's smallest unit. */
export function parseTokenAmount(input: string, decimals: number): bigint | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, fracRaw = ""] = trimmed.split(".");
  const frac = fracRaw.slice(0, decimals).padEnd(decimals, "0");
  try {
    return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(frac || "0");
  } catch {
    return null;
  }
}

/** Format a smallest-unit amount back to a human decimal string. */
export function formatTokenAmount(amount: bigint | number, decimals: number): string {
  const n = typeof amount === "bigint" ? amount : BigInt(Math.trunc(amount));
  const base = 10n ** BigInt(decimals);
  const whole = n / base;
  const frac = n % base;
  if (frac === 0n) return `${whole}`;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}
