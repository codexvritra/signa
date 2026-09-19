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

const siteUrl = "https://www.sigda.xyz";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Sigda",
    template: "%s · Sigda",
  },
  description:
    "The AI agent platform for Robinhood Chain. Launch a token and it becomes a living onchain agent — wallet-native messaging, wallet-signed thinking, spending, and earning, all re-verifiable.",
  applicationName: "Sigda",
  authors: [{ name: "Sigda" }],
  keywords: [
    "Sigda",
    "XMTP",
    "Robinhood Chain",
    "wallet messaging",
    "AI agent",
    "Groq",
    "web3 chat",
  ],
  openGraph: {
    title: "Sigda",
    description:
      "Launch a token on Robinhood Chain — it becomes a living onchain agent. Wallet-native messaging, wallet-signed at every step.",
    url: siteUrl,
    siteName: "Sigda",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sigda",
    description:
      "Launch a token on Robinhood Chain — it becomes a living onchain agent. Wallet-native messaging, wallet-signed at every step.",
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
  // (e.g. /agent/[address]) mount the provider empty and show the
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
