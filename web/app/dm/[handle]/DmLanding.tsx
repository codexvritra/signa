"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Spinner } from "@/components/ui/Spinner";
import { PeerAvatar } from "@/components/ui/Avatar";
import { shortAddress } from "@/lib/format";

/**
 * Client half of /dm/[handle]. Receives the server-resolved recipient
 * and:
 *
 *   - If the visitor's wallet is already connected: shows recipient
 *     identity + a big "Open DM" CTA that routes to /?to=<addr>. The
 *     AppShell on `/` reads the ?to= param and opens NewChatModal.
 *
 *   - If not connected: shows the Rainbow connect modal trigger and a
 *     line of copy explaining that on connect they'll be deep-linked
 *     into a fresh chat with the recipient.
 *
 *   - Once the user connects ON this page, we auto-redirect to
 *     /?to=<addr> so they don't have to click again.
 *
 * The recipient identity card is the same whether or not the visitor
 * is connected — this is the shareable surface (X bio link material).
 */
export function DmLanding({
  handle,
  address,
  basename,
  ensName,
  onSigna,
  source,
}: {
  handle: string;
  address: string;
  basename: string | null;
  ensName: string | null;
  onSigna: boolean;
  source: string;
}) {
  const router = useRouter();
  const { isConnected } = useAccount();

  // After connect-on-this-page, jump straight into the DM flow.
  useEffect(() => {
    if (isConnected) {
      router.replace(`/?to=${address}`);
    }
  }, [isConnected, address, router]);

  const display =
    basename ??
    ensName ??
    (handle.startsWith("0x") ? shortAddress(address, 8, 6) : handle);

  return (
    <section className="border-b border-white/[0.06]">
      <div className="max-w-2xl mx-auto px-6 lg:px-10 pt-16 pb-16">
        <div className="font-mono text-[11px] text-[var(--accent)] mb-5">
          $ signa dm {display}
        </div>

        <div className="flex items-start gap-5">
          <PeerAvatar address={address} size={80} />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-[-0.035em] leading-tight break-all">
              {display}
            </h1>
            <div className="text-[11px] font-mono text-white/40 mt-1.5 break-all">
              {address}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {onSigna && (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider rounded-sm px-1.5 py-0.5 border border-emerald-300/30 bg-emerald-300/[0.06] text-emerald-200">
                  <span className="size-1 rounded-full bg-emerald-300" />
                  on signa
                </span>
              )}
              <span className="text-[10px] uppercase tracking-wider rounded-sm px-1.5 py-0.5 border border-white/15 text-white/55">
                resolved via {source}
              </span>
            </div>
          </div>
        </div>

        <p className="text-white/65 mt-7 text-[15px] leading-relaxed max-w-lg">
          encrypted over XMTP V3 (MLS). signed by your wallet. no inbox, no
          phone number. {onSigna
            ? `${display} has signa enabled — your message lands instantly.`
            : `${display} isn't on signa yet — your message goes pending until they connect a wallet here.`}
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {isConnected ? (
            <>
              <Link
                href={`/?to=${address}`}
                className="bg-[var(--accent)] text-black font-semibold rounded-md px-5 py-2.5 text-[14px] inline-flex items-center gap-2 hover:brightness-110 transition uppercase tracking-wide"
              >
                Open DM <span aria-hidden className="font-mono">→</span>
              </Link>
              <span className="text-[12px] text-white/45 inline-flex items-center gap-1.5">
                <Spinner size={10} />
                redirecting…
              </span>
            </>
          ) : (
            <>
              <ConnectButton.Custom>
                {({ openConnectModal, mounted }) => (
                  <button
                    onClick={openConnectModal}
                    disabled={!mounted}
                    className="bg-[var(--accent)] text-black font-semibold rounded-md px-5 py-2.5 text-[14px] inline-flex items-center gap-2 hover:brightness-110 transition uppercase tracking-wide disabled:opacity-50"
                  >
                    Connect to DM
                  </button>
                )}
              </ConnectButton.Custom>
              <Link
                href={`/u/${encodeURIComponent(handle)}`}
                className="text-[13px] text-white/55 hover:text-white underline underline-offset-4"
              >
                or view their profile
              </Link>
            </>
          )}
        </div>

        <div className="mt-12 grid sm:grid-cols-3 gap-2 max-w-2xl">
          <Receipt label="encrypted" value="XMTP V3 · MLS" dot="bg-[var(--accent)]" />
          <Receipt label="chain" value="Base mainnet" dot="bg-blue-400" />
          <Receipt label="inline" value="ETH / USDC tips" dot="bg-emerald-400" />
        </div>
      </div>
    </section>
  );
}

function Receipt({
  label,
  value,
  dot,
}: {
  label: string;
  value: string;
  dot: string;
}) {
  return (
    <div className="border border-white/10 px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`size-1.5 rounded-full ${dot}`} />
        <span className="text-[10px] uppercase tracking-wider text-white/45 font-mono">
          {label}
        </span>
      </div>
      <span className="text-[12px] text-white/85">{value}</span>
    </div>
  );
}
