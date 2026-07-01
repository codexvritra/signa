import { NextResponse } from "next/server";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { serverClient } from "@/lib/supabase";
import {
  dealOfferPreimage, dealIdFromOffer, dealAcceptPreimage, dealDeliverPreimage, dealSettlePreimage,
  postOffer, acceptDeal, deliverDeal, settleDeal, getDeal,
} from "@/lib/deals";
import { verifyArtifact } from "@/lib/verify-artifact";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "content-type" } as const;
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

/**
 * /api/deals/demo — two ephemeral keyless agents strike + fulfill a whole deal
 * live: offer → accept → deliver → settle, each step wallet-signed, then EVERY
 * step is re-verified through the universal verifier. Proves the agreement is
 * real without any trust: both agents signed the identical terms.
 */
export async function GET() {
  const db = serverClient();
  const USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
  const buyer = privateKeyToAccount(generatePrivateKey()); // hires
  const seller = privateKeyToAccount(generatePrivateKey()); // delivers
  const from = buyer.address.toLowerCase();
  const to = seller.address.toLowerCase();
  const steps: any[] = [];

  // 1) OFFER — buyer signs the exact terms
  const t1 = Date.now();
  const terms = { ts: t1, from, to, task: "summarize the Base market and name one opportunity", amount: "5", asset: USDC, deadline: String(t1 + 86_400_000) };
  const offerSig = await buyer.signMessage({ message: dealOfferPreimage(terms) });
  const deal_id = dealIdFromOffer(terms);
  const offer = await postOffer(db, { ...terms, signature: offerSig });
  steps.push({ step: "offer", by: "buyer", ok: offer.ok, error: offer.error, deal_id });

  // 2) ACCEPT — seller signs the deal_id (= the identical terms)
  const t2 = Date.now();
  const acceptSig = await seller.signMessage({ message: dealAcceptPreimage({ ts: t2, deal: deal_id, accepter: to }) });
  const acc = await acceptDeal(db, { deal: deal_id, accepter: to, ts: t2, signature: acceptSig });
  steps.push({ step: "accept", by: "seller", ok: acc.ok, error: acc.error });

  // 3) DELIVER — seller signs the result
  const t3 = Date.now();
  const result = "Base market: risk-on, Fear&Greed rising. Opportunity: agentic-commerce infra (x402 + ERC-8004/8183 rails).";
  const deliverSig = await seller.signMessage({ message: dealDeliverPreimage({ ts: t3, deal: deal_id, worker: to, result }) });
  const del = await deliverDeal(db, { deal: deal_id, worker: to, result, ts: t3, signature: deliverSig });
  steps.push({ step: "deliver", by: "seller", ok: del.ok, error: del.error });

  // 4) SETTLE — buyer signs the payment reference (paid via /pay, x402, …)
  const t4 = Date.now();
  const payment = "settled:offchain-demo";
  const settleSig = await buyer.signMessage({ message: dealSettlePreimage({ ts: t4, deal: deal_id, payer: from, payment }) });
  const set = await settleDeal(db, { deal: deal_id, payer: from, payment, ts: t4, signature: settleSig });
  steps.push({ step: "settle", by: "buyer", ok: set.ok, error: set.error });

  // Re-verify EVERY step through the universal verifier — no trust required
  const reverify = {
    offer: await verifyArtifact({ kind: "deal_offer", ...terms, signature: offerSig }),
    accept: await verifyArtifact({ kind: "deal_accept", ts: t2, deal: deal_id, accepter: to, signature: acceptSig }),
    deliver: await verifyArtifact({ kind: "deal_deliver", ts: t3, deal: deal_id, worker: to, result, signature: deliverSig }),
    settle: await verifyArtifact({ kind: "deal_settle", ts: t4, deal: deal_id, payer: from, payment, signature: settleSig }),
  };
  const allVerified = Object.values(reverify).every((v: any) => v.valid && v.matches !== false);
  const deal = await getDeal(db, deal_id);

  return NextResponse.json({
    ok: steps.every((s) => s.ok) && allVerified,
    headline: "two keyless agents struck + fulfilled a deal — every step re-verifies",
    buyer: from, seller: to, deal_id,
    steps, reverify, all_verified: allVerified, deal,
  }, { headers: CORS });
}
