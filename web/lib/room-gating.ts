/**
 * Hold-to-chat gating (v0.43).
 *
 * A SIGNA room can be gated by holding an ERC-20: only addresses whose
 * balanceOf(token) >= gate_min_balance_raw may POST messages. Reads stay
 * open — the signatures are still the source of truth, and gating is
 * enforced server-side after signature verification.
 *
 * The check is intentionally cheap and stateless:
 *   1. Read gate config from signa_rooms.
 *   2. If gated, call balanceOf on the gate_chain RPC via viem.
 *   3. Compare against gate_min_balance_raw (uint256, string-encoded).
 *
 * Bot wallet (room creator) bypasses the gate so launch announcements
 * and system messages always land. Anyone else needs to hold.
 */
import { createPublicClient, http, type Address, type Chain } from "viem";
import { base, mainnet } from "viem/chains";

const BALANCE_OF_ABI = [
  {
    name: "balanceOf",
    type: "function" as const,
    stateMutability: "view" as const,
    inputs: [{ name: "account", type: "address" as const }],
    outputs: [{ name: "", type: "uint256" as const }],
  },
] as const;

const SYMBOL_ABI = [
  {
    name: "symbol",
    type: "function" as const,
    stateMutability: "view" as const,
    inputs: [],
    outputs: [{ name: "", type: "string" as const }],
  },
  {
    name: "decimals",
    type: "function" as const,
    stateMutability: "view" as const,
    inputs: [],
    outputs: [{ name: "", type: "uint8" as const }],
  },
] as const;

function clientForChain(chain: string) {
  switch (chain.toLowerCase()) {
    case "base":
    case "8453":
      return createPublicClient({
        chain: base,
        transport: http(process.env.BASE_RPC_URL),
      });
    case "ethereum":
    case "mainnet":
    case "1":
      return createPublicClient({
        chain: mainnet,
        transport: http(process.env.MAINNET_RPC_URL),
      });
    default:
      return null;
  }
}

export type GateConfig = {
  gate_token_address: string | null;
  gate_chain: string | null;
  gate_min_balance_raw: string | null;
  gate_token_symbol: string | null;
  gate_token_decimals: number | null;
};

export type GateCheckResult =
  | { ok: true; gated: false }
  | {
      ok: true;
      gated: true;
      symbol: string | null;
      tokenAddress: string;
      chain: string;
      minBalanceRaw: string;
      decimals: number | null;
    }
  | {
      ok: false;
      gated: true;
      reason: "insufficient_balance" | "rpc_error" | "unsupported_chain";
      symbol: string | null;
      tokenAddress: string;
      chain: string;
      minBalanceRaw: string;
      heldRaw?: string;
      decimals: number | null;
    };

/**
 * Returns whether `address` is allowed to post in a room with the given gate.
 * Pass `bypass=true` for the room creator (bot wallet) which bypasses all gates.
 */
export async function checkRoomGate(
  address: string,
  gate: GateConfig,
  bypass = false,
): Promise<GateCheckResult> {
  if (!gate.gate_token_address || !gate.gate_chain || !gate.gate_min_balance_raw) {
    return { ok: true, gated: false };
  }
  if (bypass) {
    return {
      ok: true,
      gated: true,
      symbol: gate.gate_token_symbol,
      tokenAddress: gate.gate_token_address,
      chain: gate.gate_chain,
      minBalanceRaw: gate.gate_min_balance_raw,
      decimals: gate.gate_token_decimals,
    };
  }

  const client = clientForChain(gate.gate_chain);
  if (!client) {
    return {
      ok: false,
      gated: true,
      reason: "unsupported_chain",
      symbol: gate.gate_token_symbol,
      tokenAddress: gate.gate_token_address,
      chain: gate.gate_chain,
      minBalanceRaw: gate.gate_min_balance_raw,
      decimals: gate.gate_token_decimals,
    };
  }

  try {
    const held = (await client.readContract({
      address: gate.gate_token_address as Address,
      abi: BALANCE_OF_ABI,
      functionName: "balanceOf",
      args: [address as Address],
    })) as bigint;
    const min = BigInt(gate.gate_min_balance_raw);
    if (held < min) {
      return {
        ok: false,
        gated: true,
        reason: "insufficient_balance",
        symbol: gate.gate_token_symbol,
        tokenAddress: gate.gate_token_address,
        chain: gate.gate_chain,
        minBalanceRaw: gate.gate_min_balance_raw,
        heldRaw: held.toString(),
        decimals: gate.gate_token_decimals,
      };
    }
    return {
      ok: true,
      gated: true,
      symbol: gate.gate_token_symbol,
      tokenAddress: gate.gate_token_address,
      chain: gate.gate_chain,
      minBalanceRaw: gate.gate_min_balance_raw,
      decimals: gate.gate_token_decimals,
    };
  } catch {
    return {
      ok: false,
      gated: true,
      reason: "rpc_error",
      symbol: gate.gate_token_symbol,
      tokenAddress: gate.gate_token_address,
      chain: gate.gate_chain,
      minBalanceRaw: gate.gate_min_balance_raw,
      decimals: gate.gate_token_decimals,
    };
  }
}

/**
 * Fetch on-chain symbol + decimals for a token. Used when we lazy-create a
 * gated room and want to display nice metadata.
 */
export async function fetchTokenMeta(
  tokenAddress: string,
  chain: string,
): Promise<{ symbol: string | null; decimals: number | null }> {
  const client = clientForChain(chain);
  if (!client) return { symbol: null, decimals: null };
  try {
    const [symbol, decimals] = await Promise.all([
      client
        .readContract({
          address: tokenAddress as Address,
          abi: SYMBOL_ABI,
          functionName: "symbol",
          args: [],
        })
        .catch(() => null) as Promise<string | null>,
      client
        .readContract({
          address: tokenAddress as Address,
          abi: SYMBOL_ABI,
          functionName: "decimals",
          args: [],
        })
        .catch(() => null) as Promise<number | null>,
    ]);
    return {
      symbol: symbol ?? null,
      decimals: typeof decimals === "number" ? decimals : null,
    };
  } catch {
    return { symbol: null, decimals: null };
  }
}

export function formatBalance(raw: string | null, decimals: number | null): string {
  if (!raw) return "0";
  try {
    const r = BigInt(raw);
    const d = decimals ?? 18;
    const base = 10n ** BigInt(d);
    const whole = r / base;
    const frac = r % base;
    if (frac === 0n) return whole.toString();
    const fracStr = frac.toString().padStart(d, "0").replace(/0+$/, "");
    return `${whole}.${fracStr.slice(0, 4)}`;
  } catch {
    return "0";
  }
}
