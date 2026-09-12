import { NextRequest, NextResponse } from "next/server";
import { keccak256, toBytes } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { randomBytes } from "node:crypto";
import { DEFAULT_ASSET_USDG } from "@/lib/x402-paid-dm";
import { permit2Domain, PERMIT2_WITNESS_TYPES, buildPermit2WitnessMessage, RECEIPT_SERVICE_ID } from "@/lib/permit2";
import { RH_CHAIN_ID } from "@/lib/chain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/x402/demo — run a full x402 receipt flow end to end, live.
 *
 * Generates a fresh buyer agent, has it sign a REAL Permit2 witness-transfer
 * payment authorization for a tiny amount of USDG, then issues a SIGNA
 * receipt binding the request, terms, that authorization, and the delivered
 * output. The authorization is genuine and verifiable; it is NOT broadcast —
 * no funds move. This is the agentic-commerce loop made provable in one
 * request.
 */

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  // fresh buyer agent + a deterministic demo merchant agent
  const buyer = privateKeyToAccount(generatePrivateKey());
  const seller = privateKeyToAccount(keccak256(toBytes("signa:demo-merchant:v1"))).address.toLowerCase() as `0x${string}`;

  const asset = DEFAULT_ASSET_USDG as `0x${string}`; // USDG on Robinhood Chain
  const network = `eip155:${RH_CHAIN_ID}`;
  const amount = 50000n; // 0.05 USDG (6 decimals)

  const nowSec = Math.floor(Date.now() / 1000);
  const nonce = BigInt("0x" + randomBytes(32).toString("hex"));
  const deadline = BigInt(nowSec + 3600);

  const message = buildPermit2WitnessMessage({
    token: asset,
    amount,
    spender: seller, // recipient redeems their own payment
    nonce,
    deadline,
    to: seller,
    serviceId: RECEIPT_SERVICE_ID,
  });

  // the buyer agent signs a REAL Permit2 PermitWitnessTransferFrom
  const signature = await buyer.signTypedData({
    domain: permit2Domain(RH_CHAIN_ID),
    types: PERMIT2_WITNESS_TYPES,
    primaryType: "PermitWitnessTransferFrom",
    message,
  });

  const request = {
    type: "agent_purchase",
    item: "Robinhood Chain market-data snapshot (top movers, gas)",
    buyer_agent: buyer.address,
    seller_agent: seller,
    via: "x402",
  };
  const terms = {
    amount: amount.toString(),
    asset,
    network,
    payTo: seller,
    description: "0.05 USDG for one market-data snapshot",
  };
  const payment = {
    owner: buyer.address,
    spender: seller,
    to: seller,
    token: asset,
    amount: amount.toString(),
    nonce: nonce.toString(),
    deadline: deadline.toString(),
    signature,
  };
  const output = {
    delivered: true,
    snapshot: { pair: "SIGNA/ETH", gas_gwei: 0.012, note: "sample deliverable returned to the buyer agent" },
    delivered_at: new Date(nowSec * 1000).toISOString(),
  };

  // hand it to the real issuer (verifies the authorization, signs + stores)
  const origin = req.nextUrl.origin;
  const res = await fetch(`${origin}/api/x402/receipt`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ request, terms, payment, output }),
  });
  const j = await res.json();
  return NextResponse.json(j, { status: res.status, headers: CORS });
}
