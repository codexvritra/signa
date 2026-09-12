"use client";

import { useEnsName } from "wagmi";
import { shortAddress } from "@/lib/format";
import { MAINNET_CHAIN_ID } from "@/lib/names";

/**
 * Resolves a wallet address to a display name with this priority:
 *   1. ENS primary name (Ethereum mainnet)
 *   2. Truncated address (0xABC…1234)
 */
export function PeerName({
  address,
  fallback,
  className,
}: {
  address: string | null | undefined;
  fallback?: string;
  className?: string;
}) {
  const addr = (address as `0x${string}` | undefined) ?? undefined;

  const { data: ensName } = useEnsName({
    address: addr,
    chainId: MAINNET_CHAIN_ID,
    query: { enabled: !!addr },
  });

  const display =
    ensName ??
    (address ? shortAddress(address) : fallback ?? "unknown");

  return <span className={className}>{display}</span>;
}
