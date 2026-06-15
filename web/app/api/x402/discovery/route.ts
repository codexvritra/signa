import { NextRequest, NextResponse } from "next/server";
import { listRegistered } from "@/lib/marketplace";
import { build402Challenge, DEFAULT_ASSET_BASE_USDC, EIP3009_TOKENS, X402_VERSION, type InboxPrice } from "@/lib/x402-paid-dm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/x402/discovery
 *
 * SIGNA's paid services, published in the x402 Bazaar discovery schema (the
 * same `resources` shape Coinbase's CDP discovery layer returns: resource,
 * type, x402Version, accepts, lastUpdated, metadata). Any Bazaar-aware agent
 * or tool can ingest this catalog directly and pay over x402.
 *
 * The Bazaar solves DISCOVERY. The open problem its own docs name is TRUST —
 * "did the service deliver what I paid for?" and "how do I let an agent spend
 * safely?". SIGNA is that layer: every result is wallet-signed + re-verifiable,
 * every purchase mints an x402 receipt, and agents spend inside a bounded
 * mandate. Discovery (Bazaar) + payment (x402) + proof & safe-spend (SIGNA).
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

function priceFor(payTo: string, priceUsdc: number): InboxPrice {
  const asset = DEFAULT_ASSET_BASE_USDC;
  const token = EIP3009_TOKENS[asset];
  const raw = BigInt(Math.round(priceUsdc * 10 ** (token?.decimals ?? 6))).toString();
  return { address: payTo, price_raw: raw, pay_to: payTo, asset_address: asset, asset_symbol: token?.symbol ?? "USDC", asset_decimals: token?.decimals ?? 6, chain: "base" };
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  let priced: Awaited<ReturnType<typeof listRegistered>> = [];
  try { priced = (await listRegistered(100)).filter((c) => c.price_usdc > 0); } catch { /* */ }

  const items = priced.map((c) => {
    const resource = `${origin}/api/capabilities/invoke?cap=${encodeURIComponent(c.name)}`;
    const payTo = (c.pay_to ?? c.provider_address).toLowerCase();
    const accepts = build402Challenge(priceFor(payTo, c.price_usdc), resource).accepts;
    return {
      resource,
      type: "http",
      x402Version: X402_VERSION,
      lastUpdated: new Date((c.ts || Date.now())).toISOString(),
      accepts,
      metadata: {
        name: c.name,
        description: c.description,
        input: { arg: c.input_hint || "input string" },
        inputSchema: { type: "object", properties: { arg: { type: "string", description: c.input_hint || "input" } } },
        output: { example: { ok: true, output: "<provider result>", signature: "0x…", gateway: "0x58c6…e147" }, schema: { type: "object" } },
        // SIGNA's trust layer — the half the Bazaar doesn't have
        signa: {
          provider: c.provider_address,
          result_signed_by_gateway: "0x58c69a1dabec795472dfc00b9d0e6cd2fa43e147",
          re_verify: `${origin}/api/verify`,
          receipt: `${origin}/api/x402/receipt`,
          spend_safely: `${origin}/api/mandates`,
          guarantee: "every result is wallet-signed + re-verifiable; pay within a bounded mandate; mint an x402 receipt binding request→terms→payment→delivery",
        },
      },
    };
  });

  return NextResponse.json(
    {
      x402Version: X402_VERSION,
      service: "SIGNA — the trust layer for the agent economy on Base",
      schema: "x402 Bazaar discovery (CDP-compatible resources format)",
      bazaar: "https://docs.cdp.coinbase.com/x402/bazaar",
      trust_layer: {
        discovery: "x402 Bazaar finds the service",
        payment: "x402 moves the money on Base",
        proof: "SIGNA signs the result + mints a re-verifiable receipt",
        safe_spend: "the buyer agent spends inside a human-granted, capped mandate",
      },
      count: items.length,
      items,
      note: "CDP auto-indexes a resource after a payment settles through its facilitator; SIGNA never custodies funds, so this catalog is published directly in the Bazaar schema for ingestion now.",
      generated_at: new Date().toISOString(),
    },
    { headers: CORS },
  );
}
