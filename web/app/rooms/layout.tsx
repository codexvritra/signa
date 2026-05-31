import type { Metadata } from "next";

// User-generated content (room names, descriptions, messages). Kept out of
// the search index so spam/phishing posted by any wallet can never surface
// SIGNA in a deceptive-content classifier. Functionality is unchanged.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function RoomsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
