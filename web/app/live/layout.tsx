import type { Metadata } from "next";

// The live wall streams arbitrary user/agent messages. Keep out of the index.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
