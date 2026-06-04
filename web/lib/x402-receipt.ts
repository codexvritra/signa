/**
 * x402 Receipts — the verifiable receipt layer for agentic commerce on Base.
 *
 * x402 moves the money (an EIP-3009 payment authorization). But x402 alone
 * doesn't prove WHAT was agreed: which request, which terms, which delivery.
 * A SIGNA x402 receipt binds all four — request, terms, payment authorization,
 * delivery — into one canonical envelope, signed by the SIGNA attestor wallet,
 * and re-verifiable by anyone with viem + the universal verifier. No trust in
 * SIGNA: the attestor only signs after cryptographically verifying the buyer's
 * EIP-3009 authorization. Settlement stays out-of-band — SIGNA never custodies
 * funds, never pays gas. The receipt proves the deal, not the on-chain pull.
 */
import { keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createHash } from "node:crypto";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Deterministic JSON so hashes are stable regardless of key order. */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const keys = Object.keys(v as Record<string, unknown>).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`)
    .join(",")}}`;
}

export const hashPart = (v: unknown): string => sha256(stableStringify(v));

/** The SIGNA x402 receipt attestor — a deterministic, keyless service identity. */
const ATTESTOR = privateKeyToAccount(keccak256(toBytes("signa:x402-receipt:v1")));
export const ATTESTOR_ADDRESS = ATTESTOR.address.toLowerCase();

export type X402Terms = {
  amount: string; // raw base units
  asset: string; // token address
  network: string; // CAIP-2, e.g. eip155:8453
  payTo: string;
  description?: string;
};

export type X402Payment = {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
  signature: string; // EIP-3009 typed-data signature
};

/** The exact string the attestor signs. Mirror this byte-for-byte in any verifier. */
export function receiptPreimage(a: {
  ts: number;
  buyer: string;
  seller: string;
  amount: string;
  asset: string;
  network: string;
  requestHash: string;
  termsHash: string;
  paymentHash: string;
  deliveryHash: string;
}): string {
  return [
    "SIGNA x402 receipt v1",
    `ts:${a.ts}`,
    `buyer:${a.buyer.toLowerCase()}`,
    `seller:${a.seller.toLowerCase()}`,
    `amount:${a.amount}`,
    `asset:${a.asset.toLowerCase()}`,
    `network:${a.network}`,
    `request:${a.requestHash}`,
    `terms:${a.termsHash}`,
    `payment:${a.paymentHash}`,
    `delivery:${a.deliveryHash}`,
  ].join("\n");
}

export type X402Receipt = {
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

/**
 * Issue a signed receipt. Caller MUST have already verified the EIP-3009
 * authorization signature recovers to `payment.from`. This computes the part
 * hashes, builds the canonical preimage, and signs it with the attestor.
 */
export async function issueReceipt(args: {
  request: unknown;
  terms: X402Terms;
  payment: X402Payment;
  output: unknown;
  ts: number;
}): Promise<X402Receipt> {
  const { request, terms, payment, output, ts } = args;
  const buyer = payment.from.toLowerCase();
  const seller = payment.to.toLowerCase();

  const request_hash = hashPart(request);
  const terms_hash = hashPart(terms);
  const payment_hash = hashPart(payment);
  const delivery_hash = hashPart(output ?? null);

  const signed_message = receiptPreimage({
    ts,
    buyer,
    seller,
    amount: payment.value,
    asset: terms.asset,
    network: terms.network,
    requestHash: request_hash,
    termsHash: terms_hash,
    paymentHash: payment_hash,
    deliveryHash: delivery_hash,
  });

  const signature = await ATTESTOR.signMessage({ message: signed_message });

  return {
    ts,
    buyer,
    seller,
    amount: payment.value,
    asset: terms.asset.toLowerCase(),
    network: terms.network,
    request,
    terms,
    payment,
    output,
    request_hash,
    terms_hash,
    payment_hash,
    delivery_hash,
    signer: ATTESTOR_ADDRESS,
    signature,
    signed_message,
  };
}
