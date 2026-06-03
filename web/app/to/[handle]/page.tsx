import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShareInbox } from "./ShareInbox";
import { sanitizeTo, shortAddr, type SignedNote } from "@/lib/note";
import { SITE, miniAppEmbedMeta, inboxEmbedImage } from "@/lib/miniapp";

export const dynamic = "force-dynamic";

function display(handle: string): string {
  return handle.startsWith("0x") ? shortAddr(handle) : `@${handle}`;
}

async function loadInbox(handle: string): Promise<SignedNote[]> {
  try {
    const res = await fetch(`${SITE}/api/notes?to=${encodeURIComponent(handle)}&limit=50`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const j = await res.json();
    return j?.ok ? (j.notes as SignedNote[]) : [];
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle: raw } = await params;
  const handle = sanitizeTo(decodeURIComponent(raw));
  if (!handle) return { title: "inbox · SIGNA" };
  const name = display(handle);
  const img = inboxEmbedImage(handle);
  const title = `Send ${name} a signed message on Base`;
  const desc = `Send ${name} a wallet-signed message on Base — one tap, no account, re-verifiable by anyone.`;
  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      url: `${SITE}/to/${handle}`,
      images: [{ url: img, width: 1200, height: 800 }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      images: [img],
    },
    // In-feed card → tapping it opens the Mini App pre-aimed at this inbox.
    other: miniAppEmbedMeta(img, `${SITE}/mini?to=${encodeURIComponent(handle)}`, `Send ${name} a message`),
  };
}

export default async function InboxPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle: raw } = await params;
  const handle = sanitizeTo(decodeURIComponent(raw));
  if (!handle) notFound();
  const name = display(handle);
  const notes = await loadInbox(handle);

  return (
    <div style={{ minHeight: "100dvh" }} className="bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-[600px] mx-auto px-5 py-7">
        <Link href="/mini" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/signa-logo.png" alt="SIGNA" className="size-8 rounded-full" />
          <div className="font-display font-semibold tracking-tight">SIGNA</div>
        </Link>

        <h1 className="font-display text-[28px] leading-tight font-bold mt-6">
          Send <span className="brand-text">{name}</span> a signed message
        </h1>
        <p className="text-muted text-[14px] mt-2 leading-relaxed">
          A wallet-signed message on Base — one tap, no account. The signature proves who really
          sent it, and anyone can re-verify it. {notes.length > 0 ? `${notes.length} so far.` : ""}
        </p>

        <Link
          href={`/mini?to=${encodeURIComponent(handle)}`}
          className="mt-5 h-12 rounded-xl flex items-center justify-center font-semibold text-white text-[15px] bg-gradient-to-br from-[#5b8def] to-[#8b5cf6]"
        >
          Send {name} a signed message
        </Link>

        {/* owner affordance: share this link to collect signed messages */}
        <div className="mt-3 glass rounded-xl px-3.5 py-3 flex items-center gap-2">
          <code className="flex-1 text-[12px] text-[#a5c3ff] font-mono truncate">
            signaagent.xyz/to/{handle}
          </code>
          <ShareInbox handle={handle} />
        </div>
        <div className="text-[11px] text-faint mt-2">
          This is your inbox? Post that link — anyone can sign you a message in the feed.
        </div>

        <div className="mt-8">
          <div className="text-[11px] uppercase tracking-[0.16em] text-faint mb-3">
            signed messages
          </div>
          {notes.length === 0 ? (
            <div className="text-[13px] text-faint">
              No signed messages yet — be the first to send one.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {notes.map((n) => (
                <Link
                  key={n.id}
                  href={`/n/${n.id}`}
                  className="glass rounded-xl px-4 py-3.5 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="text-[15px] leading-snug">{n.body}</div>
                  <div className="mt-2 text-[11px] text-faint font-mono">
                    {n.username ? `@${n.username}` : shortAddr(n.address)} · ✓ signed
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 text-center text-[11px] text-faint">
          signaagent.xyz · the wallet-signed message layer on Base
        </div>
      </div>
    </div>
  );
}
