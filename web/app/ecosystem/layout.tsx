import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ecosystem",
  description:
    "SIGDA integrates with MiroShark (agent simulation).",
};

export default function EcosystemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
