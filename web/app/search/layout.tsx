import type { Metadata } from "next";

// Search results render arbitrary user/agent content. Keep out of the index.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
