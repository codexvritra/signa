/**
 * On-chain capability registry reader (v1.9).
 *
 * Reads SignaCapabilityRegistry on Base. This is the trustless tier of the
 * marketplace: a provider registers a capability with a Base transaction and
 * the full callable spec (endpoint, method, price, payout) lives on chain —
 * not in any single node's database. Anyone can read it straight from Base
 * and call the capability without trusting SIGNA's index.
 *
 * Gracefully no-ops when SIGNA_CAPABILITY_REGISTRY_ADDRESS isn't configured,
 * so the app stays fully functional before the contract is deployed. Maps
 * each on-chain record to the same RegisteredCapability shape the rest of the
 * marketplace uses, so discovery + invoke + the SSRF-guarded proxy all reuse
 * the existing code unchanged.
 */
import { createPublicClient, http, type Address } from "viem";
import { base } from "viem/chains";
import type { RegisteredCapability } from "@/lib/marketplace";

export const CAPABILITY_REGISTRY_ABI = [
  {
    type: "function",
    name: "getCapability",
    stateMutability: "view",
    inputs: [{ name: "name", type: "string" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "provider", type: "address" },
          { name: "endpoint", type: "string" },
          { name: "method", type: "string" },
          { name: "description", type: "string" },
          { name: "priceUsdc", type: "uint256" },
          { name: "payTo", type: "address" },
          { name: "registeredAt", type: "uint64" },
          { name: "updatedAt", type: "uint64" },
          { name: "calls", type: "uint64" },
          { name: "active", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "listCapabilities",
    stateMutability: "view",
    inputs: [
      { name: "start", type: "uint256" },
      { name: "count", type: "uint256" },
    ],
    outputs: [
      { name: "names", type: "string[]" },
      {
        name: "page",
        type: "tuple[]",
        components: [
          { name: "provider", type: "address" },
          { name: "endpoint", type: "string" },
          { name: "method", type: "string" },
          { name: "description", type: "string" },
          { name: "priceUsdc", type: "uint256" },
          { name: "payTo", type: "address" },
          { name: "registeredAt", type: "uint64" },
          { name: "updatedAt", type: "uint64" },
          { name: "calls", type: "uint64" },
          { name: "active", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "activeCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalRegistered",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

type OnchainRow = {
  provider: string;
  endpoint: string;
  method: string;
  description: string;
  priceUsdc: bigint;
  payTo: string;
  registeredAt: bigint;
  updatedAt: bigint;
  calls: bigint;
  active: boolean;
};

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

export function capabilityRegistryAddress(): Address | null {
  const v = process.env.SIGNA_CAPABILITY_REGISTRY_ADDRESS;
  if (!v || !/^0x[a-fA-F0-9]{40}$/.test(v)) return null;
  return v as Address;
}

// A dedicated RPC for the registry chain; falls back to the shared Base RPC.
// (Pointing this at a local node lets the same reader be proven end-to-end.)
const client = createPublicClient({
  chain: base,
  transport: http(process.env.SIGNA_CAPABILITY_REGISTRY_RPC || process.env.BASE_RPC_URL),
});

/** On-chain record mapped to the marketplace's RegisteredCapability shape. */
export type OnchainCapability = RegisteredCapability & { source: "onchain"; updated_at: number };

function toCap(name: string, r: OnchainRow): OnchainCapability {
  return {
    name,
    provider_address: r.provider.toLowerCase(),
    endpoint: r.endpoint,
    method: r.method.toUpperCase(),
    description: r.description,
    input_hint: null,
    price_usdc: Number(r.priceUsdc) / 1_000_000,
    pay_to: r.payTo && r.payTo.toLowerCase() !== ZERO_ADDR ? r.payTo.toLowerCase() : null,
    ts: Number(r.registeredAt) * 1000,
    calls: Number(r.calls),
    source: "onchain",
    updated_at: Number(r.updatedAt) * 1000,
  };
}

/** List active on-chain capabilities. Empty array if not deployed / RPC down. */
export async function listOnchainCapabilities(limit = 100): Promise<OnchainCapability[]> {
  const addr = capabilityRegistryAddress();
  if (!addr) return [];
  try {
    const [names, page] = (await client.readContract({
      address: addr,
      abi: CAPABILITY_REGISTRY_ABI,
      functionName: "listCapabilities",
      args: [0n, BigInt(limit)],
    })) as [string[], OnchainRow[]];
    const out: OnchainCapability[] = [];
    for (let i = 0; i < names.length; i++) {
      if (page[i]?.active) out.push(toCap(names[i], page[i]));
    }
    return out;
  } catch {
    return [];
  }
}

/** Look up one active on-chain capability by name. Null if unknown/inactive. */
export async function getOnchainCapability(name: string): Promise<OnchainCapability | null> {
  const addr = capabilityRegistryAddress();
  if (!addr) return null;
  try {
    const r = (await client.readContract({
      address: addr,
      abi: CAPABILITY_REGISTRY_ABI,
      functionName: "getCapability",
      args: [name],
    })) as OnchainRow;
    if (!r || !r.active || r.provider.toLowerCase() === ZERO_ADDR) return null;
    return toCap(name, r);
  } catch {
    return null;
  }
}

export async function onchainCapabilityStats(): Promise<{ total: number; active: number } | null> {
  const addr = capabilityRegistryAddress();
  if (!addr) return null;
  try {
    const [total, active] = await Promise.all([
      client.readContract({ address: addr, abi: CAPABILITY_REGISTRY_ABI, functionName: "totalRegistered", args: [] }) as Promise<bigint>,
      client.readContract({ address: addr, abi: CAPABILITY_REGISTRY_ABI, functionName: "activeCount", args: [] }) as Promise<bigint>,
    ]);
    return { total: Number(total), active: Number(active) };
  } catch {
    return null;
  }
}
