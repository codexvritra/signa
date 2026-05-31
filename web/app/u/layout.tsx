import type { Metadata } from "next";

// User profile pages render arbitrary user-submitted content. Keep them out
// of the search index so spam/phishing can never surface SIGNA in a
// deceptive-content classifier. Pages still work for direct visitors.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
