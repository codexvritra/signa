import type { Metadata } from "next";
import { OracleBoard } from "./OracleBoard";
import { SITE } from "@/lib/miniapp";

export const dynamic = "force-dynamic";

const TITLE = "The Signed Oracle — the AI that can't delete its Ls";
const DESC =
  "Every alpha account deletes its bad calls. The SIGNA brain wallet-signs every market call and every verdict — so it physically can't edit or hide one. A permanent, public, falsifiable AI track record on Base. Grade it yourself. Not financial advice.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  openGraph: { title: TITLE, description: DESC, url: `${SITE}/oracle`, type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
};

export default function OraclePage() {
  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-[760px] mx-auto px-5 py-10 sm:py-14">
        <div className="text-[12px] uppercase tracking-[0.18em] text-faint">the signed oracle · live · on Base</div>
        <h1 className="font-display text-[32px] sm:text-[46px] leading-[1.04] font-bold mt-3 tracking-tight">
          The AI that can&apos;t <span className="brand-text">delete its Ls.</span>
        </h1>
        <p className="text-muted text-[16px] sm:text-[17px] mt-4 leading-relaxed">
          Every alpha account on the timeline quietly deletes its bad calls. So we built the opposite:
          the SIGNA brain makes one call on the Base Fear &amp; Greed index, <b>wallet-signs it</b>, and
          stores it forever. 24 hours later it resolves against the live signed feed — and signs the
          verdict too. Edit or delete a single call and the signature breaks. It <i>physically cannot</i>
          {" "}hide a loss. Grade it yourself.
        </p>

        <div className="mt-9">
          <OracleBoard />
        </div>

        <div className="mt-10 grid sm:grid-cols-3 gap-3">
          <Card t="Signed, not editable" d="Each call is an EIP-191 signature by the brain wallet. Tamper with it and re-verification fails." />
          <Card t="Auto-resolved" d="24h later, scored against Root's live signed Fear & Greed feed. The verdict is signed too." />
          <Card t="Re-verify anything" d="Every call + verdict is a wallet-signed message anyone can re-check with viem or at /api/verify." />
        </div>

        <div className="mt-9 pt-6 border-t border-white/[0.06] text-[12px] text-faint leading-relaxed">
          <b>Not financial advice.</b> This is an accountability experiment — the point is that the calls
          are permanent and falsifiable, not that they&apos;re right. Directional guesses on a sentiment
          index, signed in the open so the record can never be quietly cleaned up. Do not trade on it.
        </div>
      </div>
    </div>
  );
}

function Card({ t, d }: { t: string; d: string }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="text-[14px] font-semibold">{t}</div>
      <div className="text-[12px] text-muted mt-1 leading-relaxed">{d}</div>
    </div>
  );
}
