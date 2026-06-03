import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Verify } from "./Verify";
import { shortAddr, type SignedNote } from "@/lib/note";
import { SITE, miniAppEmbedMeta, noteEmbedImage, MINIAPP } from "@/lib/miniapp";

export const dynamic = "force-dynamic";

async function loadNote(id: string): Promise<SignedNote | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    const res = await fetch(`${SITE}/api/notes/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    const j = await res.json();
    return j?.ok ? (j.note as SignedNote) : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const note = await loadNote(id);
  const img = noteEmbedImage(id);
  if (!note) {
    return { title: "note not found · SIGNA" };
  }
  const who = note.username ? `@${note.username}` : shortAddr(note.address);
  const desc = `${note.body.slice(0, 150)} — signed on Base by ${who}, re-verifiable.`;
  return {
    title: `Signed on Base · ${who}`,
    description: desc,
    openGraph: {
      title: `"${note.body.slice(0, 80)}" — signed on Base`,
      description: desc,
      url: `${SITE}/n/${id}`,
      images: [{ url: img, width: 1200, height: 800 }],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `Signed on Base · ${who}`,
      description: desc,
      images: [img],
    },
    // In-feed Mini App card → tapping it opens the Mini App to sign your own.
    other: miniAppEmbedMeta(img, MINIAPP.homeUrl, "Sign your own"),
  };
}

export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const note = await loadNote(id);
  if (!note) notFound();

  const who = note.username ? `@${note.username}` : shortAddr(note.address);
  const when = new Date(note.created_at).toUTCString();

  return (
    <div style={{ minHeight: "100dvh" }} className="bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-[600px] mx-auto px-5 py-7">
        <div className="flex items-center justify-between">
          <Link href="/mini" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/signa-logo.png" alt="SIGNA" className="size-8 rounded-full" />
            <div className="font-display font-semibold tracking-tight">SIGNA</div>
          </Link>
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-wide text-[#5b8def] border border-[rgba(91,141,239,0.4)] rounded-full px-3 py-1">
            ✓ SIGNED ON BASE
          </div>
        </div>

        <div className="glass rounded-2xl p-5 mt-6">
          {note.to_label ? (
            <div className="text-[12px] text-[#a5c3ff] mb-2">→ to @{note.to_label}</div>
          ) : null}
          <div className="text-[22px] leading-relaxed">{note.body}</div>
          <div className="mt-4 pt-4 border-t border-white/[0.06] flex flex-col gap-1.5 text-[12px] text-faint font-mono">
            <div>
              signer:{" "}
              <a
                href={`https://basescan.org/address/${note.address}`}
                target="_blank"
                rel="noreferrer"
                className="text-[#a5c3ff] hover:underline"
              >
                {note.address}
              </a>
            </div>
            {note.username ? <div>farcaster: @{note.username}</div> : null}
            <div>signed: {when}</div>
            <div className="break-all">sig: {note.signature.slice(0, 38)}…</div>
          </div>
        </div>

        <p className="text-muted text-[13px] mt-4 leading-relaxed">
          This is an EIP-191 wallet signature over a canonical message. Verify it below — or run the
          identical check yourself with <span className="font-mono text-white/70">viem.recoverMessageAddress</span>.
          No trust in SIGNA required.
        </p>

        <Verify preimage={note.signed_message} signature={note.signature} expected={note.address} />

        <Link
          href="/mini"
          className="mt-6 h-12 rounded-xl flex items-center justify-center font-semibold text-white text-[15px] bg-gradient-to-br from-[#5b8def] to-[#8b5cf6]"
        >
          Sign your own on Base
        </Link>

        <div className="mt-5 text-center text-[11px] text-faint">
          signaagent.xyz · the wallet-signed message layer on Base
        </div>
      </div>
    </div>
  );
}
