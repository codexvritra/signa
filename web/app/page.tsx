"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { Chat } from "@/components/Chat";

export default function Home() {
  const { address, isConnected, chain } = useAccount();

  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-12">
      <div className="w-full max-w-md flex flex-col items-center gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            Agent Messenger
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Wallet-to-wallet & wallet-to-agent messaging on Base Sepolia.
          </p>
        </div>

        <ConnectButton />

        {isConnected && (
          <div className="w-full rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-xs">
            <div className="flex justify-between gap-3">
              <span className="text-neutral-500">Address</span>
              <span className="font-mono text-neutral-200 truncate">
                {address}
              </span>
            </div>
            <div className="mt-1.5 flex justify-between gap-3">
              <span className="text-neutral-500">Network</span>
              <span className="text-neutral-200">{chain?.name ?? "Unknown"}</span>
            </div>
          </div>
        )}

        {isConnected && <Chat />}
      </div>
    </main>
  );
}
