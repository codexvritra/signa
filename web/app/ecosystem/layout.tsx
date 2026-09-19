import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ecosystem",
  description:
    "Projects and integrations built on top of SIGDA.",
};

export default function EcosystemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
