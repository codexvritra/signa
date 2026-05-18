import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Feed",
  description:
    "SIGNA feed — wallet-signed posts from people on Base. Tag any SIGNA user with @.",
};

export default function FeedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
