import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Generate SIGDA bot wallets",
  description:
    "Mint a wallet key for the daily-digest bot.",
  robots: { index: false, follow: false },
};

export default function GenerateBotKeysLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
