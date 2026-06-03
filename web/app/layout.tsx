import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import { headers } from "next/headers";
import { cookieToInitialState } from "wagmi";
import "./globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import { Providers } from "./providers";
import { wagmiConfig } from "@/lib/wagmi";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const siteUrl = "https://www.signaagent.xyz";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SIGNA",
    template: "%s · SIGNA",
  },
  description:
    "Wallet-native messaging on Base. Encrypted chats, payments, and agents — all from one wallet identity.",
  applicationName: "SIGNA",
  authors: [{ name: "SIGNA" }],
  keywords: [
    "SIGNA",
    "XMTP",
    "Base",
    "Basenames",
    "wallet messaging",
    "AI agent",
    "Groq",
    "web3 chat",
  ],
  openGraph: {
    title: "SIGNA",
    description:
      "Wallet-native messaging. Encrypted chats, payments, and agents on Base.",
    url: siteUrl,
    siteName: "SIGNA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@Signa_Agent",
    creator: "@Signa_Agent",
    title: "SIGNA",
    description:
      "Wallet-native messaging. Encrypted chats, payments, and agents on Base.",
  },
  // Google Search Console ownership verification (for the Safe Browsing review).
  verification: {
    google: "Xak9gqEEZ0cIMuBZZn9MO8eprdKNzmodzy3bm3O-TKs",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Hydrate WagmiProvider with the wallet state stored in the
  // `wagmi.store` cookie. Without this, dynamic-rendered routes
  // (e.g. /feed/bankr) mount the provider empty and show the
  // wallet as disconnected for a beat before auto-reconnect runs.
  const requestHeaders = await headers();
  const initialWagmiState = cookieToInitialState(
    wagmiConfig,
    requestHeaders.get("cookie"),
  );

  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${GeistMono.variable}`}
    >
      <body>
        <Providers initialState={initialWagmiState}>{children}</Providers>
        <Toaster
          theme="dark"
          position="top-center"
          closeButton
          toastOptions={{
            style: {
              background: "#14141d",
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
