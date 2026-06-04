import { NextRequest, NextResponse } from "next/server";
import { keccak256, toBytes } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { randomBytes } from "node:crypto";
import { DEFAULT_ASSET_BASE_USDC, EIP3009_TOKENS } from "@/lib/x402-paid-dm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/x402/demo — run a full x402 receipt flow end to end, live.
 *
 * Generates a fresh buyer agent, has it sign a REAL EIP-3009 USDC-on-Base
 * payment authorization for a tiny amount, then issues a SIGNA receipt binding
 * the request, terms, that authorization, and the delivered output. The
 * authorization is genuine and verifiable; it is NOT broadcast — no funds move.
 * This is the agentic-commerce loop made provable in one request.
 */

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const TW_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export async function POST(req: NextRequest) {
  // fresh buyer agent + a deterministic demo merchant agent
  const buyer = privateKeyToAccount(generatePrivateKey());
  const seller = privateKeyToAccount(keccak256(toBytes("signa:demo-merchant:v1"))).address.toLowerCase();

  const asset = DEFAULT_ASSET_BASE_USDC; // USDC on Base
  const token = EIP3009_TOKENS[asset];
  const network = "eip155:8453";
  const amount = "50000"; // 0.05 USDC (6 decimals)

  const nowSec = Math.floor(Date.now() / 1000);
  const auth = {
    from: buyer.address,
    to: seller as `0x${string}`,
    value: amount,
    validAfter: String(nowSec - 60),
    validBefore: String(nowSec + 3600),
    nonce: ("0x" + randomBytes(32).toString("hex")) as `0x${string}`,
  };

  // the buyer agent signs a REAL EIP-3009 TransferWithAuthorization
  const signature = await buyer.signTypedData({
    domain: { name: token.name, version: token.version, chainId: token.chainId, verifyingContract: asset as `0x${string}` },
    types: TW_TYPES,
    primaryType: "TransferWithAuthorization",
    message: {
      from: auth.from,
      to: auth.to,
      value: BigInt(auth.value),
      validAfter: BigInt(auth.validAfter),
      validBefore: BigInt(auth.validBefore),
      nonce: auth.nonce,
    },
  });

  const request = {
    type: "agent_purchase",
    item: "Base market-data snapshot (BASE/ETH, gas, top movers)",
    buyer_agent: buyer.address,
    seller_agent: seller,
    via: "x402",
  };
  const terms = {
    amount,
    asset,
    network,
    payTo: seller,
    description: "0.05 USDC for one market-data snapshot",
  };
  const payment = { ...auth, signature };
  const output = {
    delivered: true,
    snapshot: { pair: "BASE/ETH", gas_gwei: 0.012, note: "sample deliverable returned to the buyer agent" },
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
