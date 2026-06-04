import type { Metadata } from "next";
import Link from "next/link";
import { X402Demo } from "./X402Demo";
import { SITE } from "@/lib/miniapp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "x402 Receipts — proof for agentic commerce on Base",
  description:
    "x402 moves the money. SIGNA proves the deal: every agent payment wrapped in a wallet-signed, re-verifiable receipt binding request, terms, the x402 authorization, and delivery — on Base.",
  openGraph: {
    title: "x402 moves the money. SIGNA proves the deal.",
    description:
      "The verifiable receipt layer for agentic commerce on Base. Bind request → terms → x402 payment → delivery into one signed, re-verifiable envelope.",
    url: `${SITE}/x402`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "x402 moves the money. SIGNA proves the deal.",
    description: "The verifiable receipt layer for agentic commerce on Base.",
  },
};

type Receipt = {
  id: string;
  buyer: string;
  seller: string;
  amount: string;
  request: { item?: string } | null;
  created_at: string;
};

const short = (a: string) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);
const usdc = (raw: string) => {
  try {
    return `${(Number(BigInt(raw)) / 1e6).toFixed(2)} USDC`;
  } catch {
    return raw;
  }
};

async function recent(): Promise<Receipt[]> {
  try {
    const res = await fetch(`${SITE}/api/x402/receipt?limit=6`, { cache: "no-store" });
    const j = await res.json();
    return j?.ok ? (j.receipts as Receipt[]) : [];
  } catch {
    return [];
  }
}

const STEPS = [
  { k: "1", t: "Request", d: "A buyer agent asks another agent for something — data, compute, a service.", c: "#5b8def" },
  { k: "2", t: "Terms", d: "The seller answers with an HTTP 402: price, asset, payTo — the x402 challenge.", c: "#8b5cf6" },
  { k: "3", t: "Payment", d: "The buyer signs an EIP-3009 USDC authorization on Base. The auth is the instrument.", c: "#5b8def" },
  { k: "4", t: "Delivery", d: "The seller delivers. SIGNA binds all four into one signed, re-verifiable receipt.", c: "#8b5cf6" },
];

export default async function X402Page() {
  const receipts = await recent();

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-[900px] mx-auto px-5 py-10 sm:py-14">
        {/* hero */}
        <div className="text-[12px] uppercase tracking-[0.18em] text-faint">agentic commerce · on Base</div>
        <h1 className="font-display text-[34px] sm:text-[46px] leading-[1.05] font-bold mt-3 tracking-tight">
          x402 moves the money.
          <br />
          <span className="brand-text">SIGNA proves the deal.</span>
        </h1>
        <p className="text-muted text-[16px] sm:text-[18px] mt-4 leading-relaxed max-w-[680px]">
          Over 100M agent payments have settled through x402 on Base. But x402 proves money moved — not{" "}
          <em>what was agreed</em>. SIGNA wraps every payment in a wallet-signed, re-verifiable receipt
          that binds the <b>request</b>, the <b>terms</b>, the <b>x402 authorization</b>, and the{" "}
          <b>delivery</b> into one envelope anyone can check on Base. Forever.
        </p>

        {/* how it works */}
        <div className="grid sm:grid-cols-4 gap-3 mt-9">
          {STEPS.map((s) => (
            <div key={s.k} className="glass rounded-xl p-4">
              <div
                className="size-7 rounded-lg flex items-center justify-center text-[13px] font-bold text-white mb-2.5"
                style={{ background: s.c }}
              >
                {s.k}
              </div>
              <div className="text-[14px] font-semibold">{s.t}</div>
              <div className="text-[12px] text-muted mt-1 leading-relaxed">{s.d}</div>
            </div>
          ))}
        </div>

        {/* live demo */}
        <div className="mt-10">
          <X402Demo />
        </div>

        {/* recent receipts */}
        {receipts.length > 0 && (
          <div className="mt-10">
            <div className="text-[11px] uppercase tracking-[0.16em] text-faint mb-3">
              recent receipts on Base
            </div>
            <div className="flex flex-col gap-2">
              {receipts.map((r) => (
                <Link
                  key={r.id}
                  href={`/x402/${r.id}`}
                  className="glass rounded-xl px-4 py-3 flex items-center justify-between gap-3 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-[14px] truncate">{r.request?.item ?? "agent purchase"}</div>
                    <div className="text-[11px] text-faint font-mono mt-0.5">
                      {short(r.buyer)} → {short(r.seller)}
                    </div>
                  </div>
                  <div className="text-[13px] font-semibold text-[#a5c3ff] shrink-0">{usdc(r.amount)}</div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* developers */}
        <div className="mt-12">
          <div className="text-[11px] uppercase tracking-[0.16em] text-faint mb-3">for builders</div>
          <p className="text-muted text-[14px] leading-relaxed">
            Add verifiable receipts to your own x402 server in a few lines. The{" "}
            <span className="font-mono text-white/80">signa-x402</span> SDK is <b>zero-dependency</b> —
            just <span className="font-mono text-white/80">fetch</span>.
          </p>
          <pre className="mt-3 glass rounded-xl p-4 text-[12px] font-mono text-white/80 overflow-x-auto leading-relaxed">
{`npm install ${SITE.replace("https://", "")}/sdk/signa-x402-0.1.0.tgz

import { receiptFor } from "signa-x402";

// after you verify the buyer's x402 payment + produce \`output\`:
const { url, headers } = await receiptFor({ request, terms, payment, output });
return new Response(JSON.stringify(output), { headers }); // x-signa-receipt: <url>`}
          </pre>

          <p className="text-muted text-[13px] leading-relaxed mt-4">
            Re-verify any receipt with no trust in SIGNA — the same check runs locally with viem:
          </p>
          <pre className="mt-2 glass rounded-xl p-4 text-[12px] font-mono text-white/70 overflow-x-auto leading-relaxed">
{`import { getReceipt, verifyReceipt } from "signa-x402";
const v = await verifyReceipt(await getReceipt(id));
// { valid: true, recovered: "0x…", expected: "0x…attestor", matches: true }`}
          </pre>
          <div className="text-[12px] text-faint mt-3">
            Raw HTTP: <span className="font-mono">POST /api/x402/receipt</span> ·{" "}
            <span className="font-mono">POST /api/verify</span> (kind <span className="font-mono">x402_receipt</span>) ·{" "}
            sha-256 in <span className="font-mono">/sdk/manifest.json</span>
          </div>
        </div>

        {/* honest footer */}
        <div className="mt-10 pt-6 border-t border-white/[0.06] text-[12px] text-faint leading-relaxed">
          SIGNA never settles or custodies funds. The EIP-3009 authorization is the payment instrument;
          pulling the funds is the permissionless x402 step, done out of band. A receipt proves the
          agreement, the cryptographic payment authorization, and the delivery were bound together and
          signed — it is provenance, not a settlement guarantee.
        </div>
      </div>
    </div>
  );
}
