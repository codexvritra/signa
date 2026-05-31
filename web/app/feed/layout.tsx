import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Feed",
  description:
    "SIGNA feed — wallet-signed posts from people on Base. Tag any SIGNA user with @.",
  // User-generated content: keep it out of the search index so spammed
  // links can never surface SIGNA in a deceptive-content classifier.
  robots: { index: false, follow: false },
};

export default function FeedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
