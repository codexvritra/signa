import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { X402Verify } from "./X402Verify";
import { SITE, miniAppEmbedMeta } from "@/lib/miniapp";

export const dynamic = "force-dynamic";

const short = (a: string) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || "—");
const usdc = (raw: string) => {
  try {
    return `${(Number(BigInt(raw)) / 1e6).toFixed(2)} USDC`;
  } catch {
    return raw;
  }
};

type Receipt = {
  id: string;
  ts: number;
  buyer: string;
  seller: string;
  amount: string;
  asset: string;
  network: string;
  request: { item?: string } | null;
  terms: { description?: string } | null;
  payment: { signature?: string; nonce?: string } | null;
  output: { delivered?: boolean } | null;
  request_hash: string;
  terms_hash: string;
  payment_hash: string;
  delivery_hash: string;
  signer: string;
  signature: string;
  created_at: string;
};

async function load(id: string): Promise<Receipt | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    const res = await fetch(`${SITE}/api/x402/receipt/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    const j = await res.json();
    return j?.ok ? (j.receipt as Receipt) : null;
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
  const r = await load(id);
  const img = `${SITE}/api/og/x402/${id}`;
  if (!r) return { title: "receipt not found · SIGNA" };
  const title = `x402 receipt · ${usdc(r.amount)} on Base`;
  const desc = `${r.request?.item ?? "agent purchase"} — request, terms, x402 payment, and delivery bound into one verifiable receipt.`;
  return {
    title,
    description: desc,
    openGraph: { title, description: desc, url: `${SITE}/x402/${id}`, images: [{ url: img, width: 1200, height: 800 }], type: "article" },
    twitter: { card: "summary_large_image", title, description: desc, images: [img] },
    other: miniAppEmbedMeta(img, `${SITE}/x402`, "See it live"),
  };
}

function Row({ label, children, c }: { label: string; children: React.ReactNode; c: string }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="text-[10px] uppercase tracking-[0.16em] mb-1.5" style={{ color: c }}>
        {label}
      </div>
      {children}
    </div>
  );
}

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await load(id);
  if (!r) notFound();

  const when = new Date(r.created_at).toUTCString();

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-[620px] mx-auto px-5 py-8">
        <div className="flex items-center justify-between">
          <Link href="/x402" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/signa-logo.png" alt="SIGNA" className="size-8 rounded-full" />
            <div className="font-display font-semibold tracking-tight">SIGNA · x402</div>
          </Link>
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-wide text-[#5b8def] border border-[rgba(91,141,239,0.4)] rounded-full px-3 py-1">
            ✓ x402 RECEIPT
          </div>
        </div>

        <div className="mt-6 flex items-baseline justify-between">
          <h1 className="font-display text-[24px] font-bold tracking-tight">{usdc(r.amount)} on Base</h1>
          <div className="text-[12px] text-faint font-mono">{r.network}</div>
        </div>
        <div className="text-[14px] text-muted mt-1">{r.request?.item ?? "agent purchase"}</div>

        <div className="grid sm:grid-cols-2 gap-3 mt-5">
          <Row label="1 · request" c="#5b8def">
            <div className="text-[13px]">{r.request?.item ?? "agent purchase"}</div>
            <div className="mt-1 text-[11px] text-faint font-mono">buyer {short(r.buyer)}</div>
          </Row>
          <Row label="2 · terms" c="#8b5cf6">
            <div className="text-[13px]">{r.terms?.description ?? usdc(r.amount)}</div>
            <div className="mt-1 text-[11px] text-faint font-mono">payTo {short(r.seller)}</div>
          </Row>
          <Row label="3 · x402 payment" c="#5b8def">
            <div className="text-[13px]">EIP-3009 authorization ✓ verified</div>
            <div className="mt-1 text-[11px] text-faint font-mono break-all">sig {short(r.payment?.signature ?? "")}</div>
          </Row>
          <Row label="4 · delivery" c="#8b5cf6">
            <div className="text-[13px]">{r.output?.delivered ? "delivered ✓" : "—"}</div>
            <div className="mt-1 text-[11px] text-faint font-mono">hash {short(r.delivery_hash)}</div>
          </Row>
        </div>

        <div className="glass rounded-2xl p-4 mt-4 text-[12px] text-faint font-mono flex flex-col gap-1.5">
          <div>
            buyer:{" "}
            <a href={`https://basescan.org/address/${r.buyer}`} target="_blank" rel="noreferrer" className="text-[#a5c3ff] hover:underline">
              {r.buyer}
            </a>
          </div>
          <div>
            seller:{" "}
            <a href={`https://basescan.org/address/${r.seller}`} target="_blank" rel="noreferrer" className="text-[#a5c3ff] hover:underline">
              {r.seller}
            </a>
          </div>
          <div>attestor: {r.signer}</div>
          <div>issued: {when}</div>
          <div className="break-all">sig: {r.signature.slice(0, 40)}…</div>
        </div>

        <p className="text-muted text-[13px] mt-4 leading-relaxed">
          The SIGNA attestor signed an envelope binding all four parts. Re-verify it below, or run the
          same check yourself with <span className="font-mono text-white/70">viem.recoverMessageAddress</span> —
          no trust in SIGNA.
        </p>

        <X402Verify
          fields={{
            ts: r.ts,
            buyer: r.buyer,
            seller: r.seller,
            amount: r.amount,
            asset: r.asset,
            network: r.network,
            request_hash: r.request_hash,
            terms_hash: r.terms_hash,
            payment_hash: r.payment_hash,
            delivery_hash: r.delivery_hash,
            signature: r.signature,
          }}
        />

        <Link
          href="/x402"
          className="mt-6 h-12 rounded-xl flex items-center justify-center font-semibold text-white text-[15px] bg-gradient-to-br from-[#5b8def] to-[#8b5cf6]"
        >
          x402 moves the money. SIGNA proves the deal →
        </Link>

        <div className="mt-5 text-center text-[11px] text-faint">
          SIGNA never settles or custodies funds · provenance, not a settlement guarantee
        </div>
      </div>
    </div>
  );
}
