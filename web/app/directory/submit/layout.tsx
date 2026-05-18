import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Submit an agent",
  description:
    "Add your XMTP agent to the SIGNA directory. One signature from the agent's wallet verifies ownership.",
  robots: { index: false, follow: false },
};

export default function SubmitAgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
