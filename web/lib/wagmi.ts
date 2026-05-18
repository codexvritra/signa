import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base, mainnet } from "wagmi/chains";
import { http, cookieStorage, createStorage } from "wagmi";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!projectId) {
  throw new Error(
    "Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID — add it in Vercel project settings (Environment Variables).",
  );
}

export const wagmiConfig = getDefaultConfig({
  appName: "SIGNA",
  projectId,
  // base = primary app chain (real ETH, real txs).
  // mainnet = ENS reverse + Basenames (via ENSIP-19 coinType) read from base too.
  chains: [base, mainnet],
  transports: {
    [base.id]: http(),
    [mainnet.id]: http(),
  },
  ssr: true,
  // Persist wallet connection in a cookie so the server can hand the
  // initial state to WagmiProvider via cookieToInitialState() in the root
  // layout. Without cookie storage, server-rendered routes (force-dynamic
  // pages like /feed/bankr, /agent/[address], /launchpad) hydrate with an
  // empty wagmi state and the wallet briefly appears disconnected before
  // auto-reconnect runs.
  storage: createStorage({ storage: cookieStorage }),
});
