import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Generate SIGNA bot wallets",
  description:
    "Mint wallet keys for the MiroShark / gitlawb / Bankr event-bridge bots.",
  robots: { index: false, follow: false },
};

export default function GenerateBotKeysLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
