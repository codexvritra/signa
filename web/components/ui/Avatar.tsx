"use client";

import { useEnsAvatar, useEnsName } from "wagmi";
import { normalize } from "viem/ens";
import { MAINNET_CHAIN_ID } from "@/lib/names";
import { GradientAvatar } from "./GradientAvatar";
import { cn } from "@/lib/cn";

/**
 * Peer avatar with this priority:
 *   1. ENS avatar (if address has a primary ENS name + an avatar record)
 *   2. Deterministic SIGDA-palette gradient avatar (always works)
 */
export function PeerAvatar({
  address,
  size = 32,
  className,
}: {
  address: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const addr = (address as `0x${string}` | undefined) ?? undefined;

  const { data: ensName } = useEnsName({
    address: addr,
    chainId: MAINNET_CHAIN_ID,
    query: { enabled: !!addr },
  });

  const { data: avatarUrl } = useEnsAvatar({
    name: ensName ? normalize(ensName) : undefined,
    chainId: MAINNET_CHAIN_ID,
    query: { enabled: !!ensName },
  });

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={ensName ?? address ?? "avatar"}
        width={size}
        height={size}
        className={cn("rounded-full object-cover flex-shrink-0", className)}
      />
    );
  }

  return <GradientAvatar seed={address ?? null} size={size} className={className} />;
}
