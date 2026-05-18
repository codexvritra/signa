import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { baseSepolia } from "wagmi/chains";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!projectId) {
  throw new Error(
    "Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID — add it in Vercel project settings (Environment Variables).",
  );
}

export const wagmiConfig = getDefaultConfig({
  appName: "Agent Messenger",
  projectId,
  chains: [baseSepolia],
  ssr: true,
});
