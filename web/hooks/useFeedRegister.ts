"use client";

import { useEffect, useRef } from "react";
import { useAccount, useEnsName, useSignMessage } from "wagmi";
import { mainnet } from "wagmi/chains";
import { BASE_CHAIN_ID, BASE_COINTYPE } from "@/lib/names";
import { buildMessageToSign } from "@/lib/feed-types";

/**
 * On first connect + XMTP-ready, register the user with the feed backend
 * so they appear in @mention autocomplete and can be the author of posts.
 * Idempotent. Stores a "registered for this address" flag in localStorage
 * to skip the signature prompt on subsequent loads.
 */
export function useFeedRegister(opts: { xmtpReady: boolean }) {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const fired = useRef<string | null>(null);

  const { data: basename } = useEnsName({
    address,
    chainId: BASE_CHAIN_ID,
    coinType: BASE_COINTYPE,
    query: { enabled: !!address && opts.xmtpReady },
  });
  const { data: ensName } = useEnsName({
    address,
    chainId: mainnet.id,
    query: { enabled: !!address && opts.xmtpReady },
  });

  useEffect(() => {
    if (!opts.xmtpReady || !address) return;
    const key = `signa:feed-registered:${address.toLowerCase()}`;
    if (typeof window === "undefined") return;
    if (localStorage.getItem(key)) return;
    if (fired.current === address) return;
    fired.current = address;

    (async () => {
      try {
        const ts = Date.now();
        const message = buildMessageToSign({
          kind: "register",
          address: address.toLowerCase(),
          basename: basename ?? null,
          ens_name: ensName ?? null,
          ts,
        });
        const signature = await signMessageAsync({ message });
        const res = await fetch("/api/users/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            address,
            basename: basename ?? null,
            ens_name: ensName ?? null,
            ts,
            signature,
          }),
        });
        if (res.ok) {
          localStorage.setItem(key, "1");
        }
      } catch {
        // User likely rejected the signature. Will try again next session.
        fired.current = null;
      }
    })();
  }, [address, basename, ensName, opts.xmtpReady, signMessageAsync]);
}
