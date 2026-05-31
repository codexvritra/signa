import type { Metadata } from "next";

// Personal dashboard + mentions render user-specific and user-submitted
// content. Keep out of the search index.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function MeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
