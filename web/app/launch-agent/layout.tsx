import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Launch your AI agent · SIGNA",
  description:
    "Launch a wallet-native AI agent in 60 seconds. Inherits the full stack: chat (XMTP), identity (ERC-8004 ready), code (gitlawb), token (Bankr), intelligence (MiroShark).",
};

export default function LaunchAgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
