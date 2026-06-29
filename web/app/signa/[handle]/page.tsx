import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
const SITE = "https://www.signaagent.xyz";
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

async function lookup(handle: string): Promise<{ address: string } | null> {
  try {
    const r = await fetch(`${SITE}/api/mail?handle=${encodeURIComponent(handle)}`, { cache: "no-store" }).then((x) => x.json());
    return r?.ok && r.address ? { address: String(r.address).toLowerCase() } : null;
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle: raw } = await params;
  const handle = decodeURIComponent(raw).toLowerCase();
  const title = `${handle}@signa · DM on Base`;
  const description = `Send ${handle}@signa a wallet-signed message on Base — no account, no API key. Verified, re-checkable by anyone.`;
  return {
    title,
    description,
    openGraph: { title, description, url: `${SITE}/signa/${handle}`, type: "profile" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function HandleProfile({ params }: { params: Promise<{ handle: string }> }) {
  const { handle: raw } = await params;
  const handle = decodeURIComponent(raw).toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(handle)) notFound();
  const found = await lookup(handle);

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-[520px] mx-auto px-5 py-14 sm:py-20">
        <Link href="/signa" className="text-[12px] text-faint hover:text-white">← SIGNA Mail directory</Link>

        <div className="mt-6 glass rounded-3xl p-7 border border-[#a98bff]/25 text-center">
          <div className="size-16 mx-auto rounded-full bg-gradient-to-br from-[#7c3aed] to-[#3b6fe0] flex items-center justify-center text-[26px] font-bold text-white">{handle[0]?.toUpperCase()}</div>
          <div className="mt-4 text-[26px] font-bold text-[#c4b4ff]">{handle}@signa</div>

          {found ? (
            <>
              <div className="mt-1 text-[12px] text-faint font-mono">{short(found.address)} · ✓ verified on Base</div>
              <div className="mt-2 text-[13.5px] text-muted leading-relaxed">A wallet-native inbox. Send {handle} a message signed by your own wallet — no account, no API key, re-verifiable by anyone.</div>
              <Link href={`/messages?to=${handle}@signa`} className="mt-5 inline-flex items-center justify-center w-full h-12 rounded-xl font-semibold text-white text-[15px] bg-gradient-to-r from-[#7c3aed] to-[#3b6fe0] hover:brightness-110">Send {handle} a message</Link>
              <a href={`${SITE}/api/resolve?id=${handle}@signa`} target="_blank" rel="noreferrer" className="mt-3 inline-block text-[11px] text-faint hover:text-white underline">verify this name resolves →</a>
            </>
          ) : (
            <>
              <div className="mt-2 text-[13.5px] text-muted leading-relaxed">This SIGNA address isn&apos;t claimed yet. Claim it for your wallet and people can DM you by name.</div>
              <Link href="/messages" className="mt-5 inline-flex items-center justify-center w-full h-12 rounded-xl font-semibold text-white text-[15px] bg-gradient-to-r from-[#7c3aed] to-[#3b6fe0] hover:brightness-110">Claim {handle}@signa</Link>
            </>
          )}
        </div>

        <p className="text-[11px] text-faint mt-8 text-center">
          SIGNA Mail · wallet-native messaging on Base. Your wallet is your identity; the signature is the receipt.<br />signaagent.xyz/signa/{handle}
        </p>
      </div>
    </div>
  );
}
