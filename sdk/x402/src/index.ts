/**
 * signa-x402 — verifiable receipts for x402 agentic commerce on Base.
 *
 * x402 moves the money. SIGNA proves the deal: it binds request → terms →
 * the x402 payment authorization (EIP-3009) → delivery into one envelope,
 * signed by the SIGNA attestor and re-verifiable by anyone on Base.
 *
 * Zero dependencies — just fetch. Drop it into any x402 server: after you
 * verify a payment, issue a receipt and hand the buyer a proof URL.
 *
 *   import { issueReceipt, receiptHeaders } from "signa-x402";
 *   const receipt = await issueReceipt({ request, terms, payment, output });
 *   // attach receiptHeaders(receipt) to your response, or return receipt.id
 */

export const DEFAULT_BASE = "https://www.signaagent.xyz";

export type X402Terms = {
  /** raw base units, e.g. "50000" for 0.05 USDC */
  amount: string;
  /** token contract address */
  asset: string;
  /** CAIP-2 network, e.g. "eip155:8453" for Base */
  network: string;
  /** the merchant address the payment authorizes */
  payTo: string;
  description?: string;
};

/** An x402 "exact" EIP-3009 TransferWithAuthorization + its signature. */
export type X402Payment = {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
  signature: string;
};

export type X402Deal = {
  request?: unknown;
  terms: X402Terms;
  payment: X402Payment;
  output?: unknown;
};

export type X402Receipt = {
  id: string;
  ts: number;
  buyer: string;
  seller: string;
  amount: string;
  asset: string;
  network: string;
  request: unknown;
  terms: X402Terms;
  payment: X402Payment;
  output: unknown;
  request_hash: string;
  terms_hash: string;
  payment_hash: string;
  delivery_hash: string;
  signer: string;
  signature: string;
  signed_message: string;
};

export type VerifyResult = {
  ok: boolean;
  valid?: boolean;
  recovered?: string | null;
  expected?: string | null;
  matches?: boolean | null;
  signer_role?: string;
  error?: string;
};

export type Options = { baseUrl?: string; fetch?: typeof fetch };

function f(opts?: Options): typeof fetch {
  return opts?.fetch ?? fetch;
}

/**
 * Issue a SIGNA receipt for an x402 deal. The buyer's EIP-3009 authorization
 * is verified server-side before the receipt is signed — throws if it doesn't
 * recover to `payment.from`.
 */
export async function issueReceipt(deal: X402Deal, opts: Options = {}): Promise<X402Receipt> {
  const base = opts.baseUrl ?? DEFAULT_BASE;
  const res = await f(opts)(`${base}/api/x402/receipt`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(deal),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j?.ok) {
    throw new Error(`signa-x402: issue failed: ${j?.error ?? `HTTP ${res.status}`}`);
  }
  return j.receipt as X402Receipt;
}

/** Fetch a receipt by id (returns null if not found). */
export async function getReceipt(id: string, opts: Options = {}): Promise<X402Receipt | null> {
  const base = opts.baseUrl ?? DEFAULT_BASE;
  const res = await f(opts)(`${base}/api/x402/receipt/${id}`);
  if (!res.ok) return null;
  const j = await res.json().catch(() => ({}));
  return j?.ok ? (j.receipt as X402Receipt) : null;
}

/**
 * Re-verify a receipt against the SIGNA universal verifier. Returns the
 * recovered signer + whether it matches the attestor. The same check runs
 * locally with viem.recoverMessageAddress over `receipt.signed_message` — no
 * trust in SIGNA required.
 */
export async function verifyReceipt(
  receipt: Pick<
    X402Receipt,
    | "ts" | "buyer" | "seller" | "amount" | "asset" | "network"
    | "request_hash" | "terms_hash" | "payment_hash" | "delivery_hash" | "signature"
  >,
  opts: Options = {},
): Promise<VerifyResult> {
  const base = opts.baseUrl ?? DEFAULT_BASE;
  const res = await f(opts)(`${base}/api/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      kind: "x402_receipt",
      ts: receipt.ts,
      buyer: receipt.buyer,
      seller: receipt.seller,
      amount: receipt.amount,
      asset: receipt.asset,
      network: receipt.network,
      request_hash: receipt.request_hash,
      terms_hash: receipt.terms_hash,
      payment_hash: receipt.payment_hash,
      delivery_hash: receipt.delivery_hash,
      signature: receipt.signature,
    }),
  });
  return (await res.json().catch(() => ({ ok: false, error: "bad_response" }))) as VerifyResult;
}

/** The public receipt permalink (renders a verifiable card; unfurls in-feed). */
export function receiptUrl(id: string, opts: Options = {}): string {
  return `${opts.baseUrl ?? DEFAULT_BASE}/x402/${id}`;
}

/**
 * Response headers to hand the buyer back so they (or anyone) can find + verify
 * the receipt. Attach these to your x402 response.
 */
export function receiptHeaders(receipt: X402Receipt, opts: Options = {}): Record<string, string> {
  return {
    "x-signa-receipt": receiptUrl(receipt.id, opts),
    "x-signa-receipt-id": receipt.id,
  };
}

/** Convenience: issue a receipt and return it with its url + headers in one call. */
export async function receiptFor(
  deal: X402Deal,
  opts: Options = {},
): Promise<{ receipt: X402Receipt; url: string; headers: Record<string, string> }> {
  const receipt = await issueReceipt(deal, opts);
  return { receipt, url: receiptUrl(receipt.id, opts), headers: receiptHeaders(receipt, opts) };
}
