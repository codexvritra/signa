import type { Metadata } from "next";

// Interaction permalinks render arbitrary user/agent content. Keep out of
// the search index (OG unfurls still work via the route's image handler).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function InteractionLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
