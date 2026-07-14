import { NextRequest, NextResponse } from "next/server";
import { attestRegistry, attestStock, findStock, STOCK_TOKENS, RWA_ATTESTOR_ADDRESS, RWA_CHAIN_NAME } from "@/lib/rwa";
import { RH_CHAIN_ID, RH_EXPLORER } from "@/lib/signa-launch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/rwa — SIGNA Proof-of-Stock: the verifiable canonical registry of
 * Robinhood Chain Stock Tokens.
 *
 *   GET (no args)      → every canonical Stock Token, each with a fresh signed attestation
 *   GET ?ticker=NVDA   → one token (ticker or contract address)
 *   GET ?market=0      → skip the explorer market lookup (faster, onchain-only)
 *
 * Each attestation is read live from Robinhood Chain, pinned to a block, and
 * signed by the SIGNA RWA attestor. Re-verify at /api/verify (kind
 * `rwa_attestation`) and independently by replaying the eth_call at that block.
 */
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "content-type" } as const;
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("ticker") ?? sp.get("token");
  const withMarket = sp.get("market") !== "0";

  const meta = {
    chain: RH_CHAIN_ID,
    chain_name: RWA_CHAIN_NAME,
    explorer: RH_EXPLORER,
    attestor: RWA_ATTESTOR_ADDRESS,
    verify_kind: "rwa_attestation",
    registry_size: STOCK_TOKENS.length,
  };

  try {
    if (q) {
      const token = findStock(q);
      if (!token) {
        return NextResponse.json(
          { ok: false, error: "not_in_canonical_registry", hint: "SIGNA only attests contracts it has verified as the official Robinhood Stock Token", tickers: STOCK_TOKENS.map((t) => t.ticker) },
          { status: 404, headers: CORS },
        );
      }
      const attestation = await attestStock(token, undefined, withMarket);
      return NextResponse.json({ ok: true, ...meta, attestation }, { headers: CORS });
    }

    const tokens = await attestRegistry(withMarket);
    return NextResponse.json({ ok: true, ...meta, count: tokens.length, block: tokens[0]?.block ?? null, tokens }, { headers: CORS });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, ...meta, error: e instanceof Error ? e.message : "chain_read_failed" }, { status: 502, headers: CORS });
  }
}
