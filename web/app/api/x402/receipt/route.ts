import { NextRequest, NextResponse } from "next/server";
import { serverClient, supabase } from "@/lib/supabase";
import { issueReceipt, type X402Terms, type X402Payment } from "@/lib/x402-receipt";
import { verifyTransferAuthorization } from "@/lib/x402-paid-dm";
import { RECEIPT_SERVICE_ID } from "@/lib/permit2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/x402/receipt
 *
 * Issue a SIGDA x402 receipt. The caller submits the deal: the request, the
 * terms, the buyer's Permit2 witness-transfer payment authorization (+
 * signature), and the delivered output. We cryptographically verify the
 * authorization recovers to the buyer, then bind all four parts into one
 * canonical envelope signed by the SIGDA attestor — re-verifiable by anyone
 * via /api/verify (kind x402_receipt).
 *
 * SIGDA never settles. The Permit2 authorization is the payment instrument;
 * pulling the funds is a permissionless out-of-band step. The receipt proves
 * the agreement + the authorization + the delivery were bound together.
 *
 * POST — issue a receipt. GET — recent receipts.
 */

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
function json(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, { ...init, headers: { ...(init?.headers ?? {}), ...CORS } });
}

export async function GET(req: NextRequest) {
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 10), 50);
  const { data, error } = await supabase
    .from("x402_receipts")
    .select(
      "id, ts, buyer, seller, amount, asset, network, request, terms, output, request_hash, terms_hash, payment_hash, delivery_hash, signer, signature, signed_message, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return json({ ok: false, error: error.message }, { status: 500 });
  return json({ ok: true, count: data?.length ?? 0, receipts: data ?? [] });
}

export async function POST(req: NextRequest) {
  let body: { request?: unknown; terms?: X402Terms; payment?: X402Payment; output?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const terms = body.terms;
  const payment = body.payment;
  if (!terms || !payment) return json({ ok: false, error: "missing_terms_or_payment" }, { status: 400 });

  // shape checks
  for (const f of ["amount", "asset", "network", "payTo"] as const) {
    if (!terms[f]) return json({ ok: false, error: `missing_terms_${f}` }, { status: 400 });
  }
  for (const f of ["owner", "spender", "to", "token", "amount", "nonce", "deadline", "signature"] as const) {
    if (!payment[f]) return json({ ok: false, error: `missing_payment_${f}` }, { status: 400 });
  }
  if (payment.to.toLowerCase() !== terms.payTo.toLowerCase()) {
    return json({ ok: false, error: "payment_to_does_not_match_terms_payTo" }, { status: 400 });
  }
  let amount: bigint, required: bigint;
  try {
    amount = BigInt(payment.amount);
    required = BigInt(terms.amount);
  } catch {
    return json({ ok: false, error: "invalid_amount" }, { status: 400 });
  }
  if (amount < required) return json({ ok: false, error: "underpaid" }, { status: 400 });

  // the core check: the buyer really authorized this exact payment
  const v = await verifyTransferAuthorization({
    owner: payment.owner,
    spender: payment.spender,
    to: payment.to,
    token: payment.token,
    amount: payment.amount,
    nonce: payment.nonce,
    deadline: payment.deadline,
    signature: payment.signature,
    network: terms.network,
    expectedServiceId: RECEIPT_SERVICE_ID,
  });
  if (!v.ok) return json({ ok: false, error: v.reason }, { status: 401 });

  const ts = Date.now();
  const receipt = await issueReceipt({
    request: body.request ?? null,
    terms,
    payment,
    output: body.output ?? null,
    ts,
  });

  const db = serverClient();
  const { data: inserted, error: insErr } = await db
    .from("x402_receipts")
    .insert({
      ts: receipt.ts,
      buyer: receipt.buyer,
      seller: receipt.seller,
      amount: receipt.amount,
      asset: receipt.asset,
      network: receipt.network,
      request: receipt.request,
      terms: receipt.terms,
      payment: receipt.payment,
      output: receipt.output,
      request_hash: receipt.request_hash,
      terms_hash: receipt.terms_hash,
      payment_hash: receipt.payment_hash,
      delivery_hash: receipt.delivery_hash,
      signer: receipt.signer,
      signature: receipt.signature,
      signed_message: receipt.signed_message,
    })
    .select(
      "id, ts, buyer, seller, amount, asset, network, request, terms, output, request_hash, terms_hash, payment_hash, delivery_hash, signer, signature, signed_message, created_at",
    )
    .single();
  if (insErr || !inserted) {
    return json({ ok: false, error: insErr?.message ?? "insert_failed" }, { status: 500 });
  }

  return json({ ok: true, receipt: inserted });
}
