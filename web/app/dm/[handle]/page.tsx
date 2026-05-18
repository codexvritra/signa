import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";
import { DmLanding } from "./DmLanding";

export const dynamic = "force-dynamic";

type ResolvedUser = {
  ok: true;
  handle: string;
  address: string;
  basename: string | null;
  ens_name: string | null;
  on_signa: boolean;
  source: string;
};

async function resolveHandle(handle: string): Promise<ResolvedUser | null> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("host") || "www.signaagent.xyz";
  try {
    const res = await fetch(
      `${proto}://${host}/api/users/resolve?handle=${encodeURIComponent(handle)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const j = await res.json();
    if (!j.ok) return null;
    return j as ResolvedUser;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle: raw } = await params;
  const handle = decodeURIComponent(raw);
  const display = handle.length > 30 ? `${handle.slice(0, 30)}…` : handle;
  return {
    title: `DM ${display} on SIGNA`,
    description: `Wallet-native, end-to-end encrypted DM with ${display} over XMTP on Base. No accounts. No phone numbers. Just connect your wallet.`,
    openGraph: {
      title: `DM ${display} on SIGNA`,
      description: `Wallet-native DM. Encrypted. Signed. On Base.`,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `DM ${display} on SIGNA`,
      description: `Wallet-native DM. Encrypted. Signed. On Base.`,
    },
  };
}

export default async function DmHandlePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle: raw } = await params;
  const handle = decodeURIComponent(raw);

  const resolved = await resolveHandle(handle);
  if (!resolved) {
    // Render a soft 404 so the URL is still shareable even if the
    // recipient hasn't joined yet. We want "send me an invite" energy,
    // not a dead end.
    return (
      <div className="min-h-screen flex flex-col">
        <AppHeader />
        <main className="flex-1">
          <section className="border-b border-white/[0.06]">
            <div className="max-w-2xl mx-auto px-6 lg:px-10 pt-20 pb-16">
              <div className="font-mono text-[11px] text-amber-300 mb-4">
                $ signa resolve {handle}
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-[-0.035em] leading-tight">
                not on signa yet.
              </h1>
              <p className="text-white/65 mt-5 text-[15px] leading-relaxed max-w-lg">
                <span className="font-mono text-white">{handle}</span> doesn&apos;t
                resolve to a wallet on SIGNA, Basenames, or ENS. send them this
                link and they can enable messaging in 2 clicks — their wallet
                becomes their inbox.
              </p>
              <div className="mt-7 border border-dashed border-white/15 px-4 py-3 font-mono text-[12px] text-white/70 max-w-md">
                signaagent.xyz/dm/{handle}
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1">
        <DmLanding
          handle={resolved.handle}
          address={resolved.address}
          basename={resolved.basename}
          ensName={resolved.ens_name}
          onSigna={resolved.on_signa}
          source={resolved.source}
        />
      </main>
      <Footer />
    </div>
  );
}
