import type { Metadata } from "next";

// Agent profile pages render arbitrary agent-submitted content (bios,
// messages). Keep them out of the search index so spam/phishing can never
// surface SIGNA in a deceptive-content classifier. Note: this only affects
// page renders — the A2A agent-card route handler and OG images are
// unaffected, so discovery + unfurls keep working.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
