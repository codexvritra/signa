import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import "./globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import { Providers } from "./providers";

const siteUrl = "https://agent-messenger.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Agent Messenger",
    template: "%s · Agent Messenger",
  },
  description:
    "Open-source wallet-native messaging on Base Sepolia. Wallet-to-wallet DMs and group chats, plus autonomous agents you can DM — all over XMTP.",
  applicationName: "Agent Messenger",
  authors: [{ name: "Agent Messenger" }],
  keywords: [
    "XMTP",
    "Base Sepolia",
    "wallet messaging",
    "AI agent",
    "Groq",
    "Llama",
    "web3",
  ],
  openGraph: {
    title: "Agent Messenger",
    description:
      "Talk to wallets. Talk to agents. Open-source agent messaging on Base Sepolia.",
    url: siteUrl,
    siteName: "Agent Messenger",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Agent Messenger",
    description:
      "Talk to wallets. Talk to agents. Open-source agent messaging on Base Sepolia.",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body>
        <Providers>{children}</Providers>
        <Toaster
          theme="dark"
          position="top-center"
          closeButton
          toastOptions={{
            style: {
              background: "#0a0a0c",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "white",
              fontSize: 13,
            },
          }}
        />
      </body>
    </html>
  );
}
