import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Feed",
  description:
    "SIGDA feed — wallet-signed posts from people on Robinhood Chain. Tag any SIGDA user with @.",
  // User-generated content: keep it out of the search index so spammed
  // links can never surface SIGDA in a deceptive-content classifier.
  robots: { index: false, follow: false },
};

export default function FeedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
