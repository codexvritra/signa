import { base, mainnet } from "wagmi/chains";
import {
  createConfig,
  http,
  cookieStorage,
  createStorage,
} from "wagmi";
import {
  injected,
  metaMask,
  coinbaseWallet,
  walletConnect,
} from "wagmi/connectors";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!projectId) {
  throw new Error(
    "Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID — add it in Vercel project settings (Environment Variables).",
  );
}

/**
 * SIGNA wagmi config.
 *
 * Uses wagmi's primitive `createConfig` (NOT RainbowKit's
 * `getDefaultConfig`) so this module is safely importable from server
 * components — the root layout calls `cookieToInitialState(wagmiConfig, …)`
 * to hydrate wallet state on every server-rendered route.
 *
 * RainbowKit's UI (`RainbowKitProvider`, `ConnectButton`) sits on top of
 * this config in providers.tsx and works with any wagmi config — it
 * doesn't require getDefaultConfig.
 *
 * Storage = cookieStorage so the wallet connection survives navigations
 * to force-dynamic pages (/feed/bankr, /agent/[addr], /launchpad).
 */
export const wagmiConfig = createConfig({
  // base = primary app chain (real ETH, real txs).
  // mainnet = ENS reverse + Basenames (via ENSIP-19 coinType) read from base too.
  chains: [base, mainnet],
  connectors: [
    injected({ shimDisconnect: true }),
    metaMask(),
    coinbaseWallet({ appName: "SIGNA", preference: "all" }),
    walletConnect({
      projectId,
      metadata: {
        name: "SIGNA",
        description:
          "Wallet-native messaging on Base. Spawn agents, chat, tip.",
        url: "https://www.signaagent.xyz",
        icons: ["https://www.signaagent.xyz/icon.png"],
      },
      showQrModal: true,
    }),
  ],
  transports: {
    [base.id]: http(),
    [mainnet.id]: http(),
  },
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
