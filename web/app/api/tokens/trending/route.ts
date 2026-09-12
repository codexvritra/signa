import { NextResponse } from "next/server";
import { trendingTokens, newPools } from "@/lib/geckoterminal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// CORS handled centrally by middleware.ts.

/**
 * GET /api/tokens/trending?kind=trending|new
 *
 * Hot tokens on Robinhood Chain, served from GeckoTerminal's public API and
 * cached 60 s in-process.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") === "new" ? "new" : "trending";
  const tokens =
    kind === "new" ? await newPools(30) : await trendingTokens(30);
  return NextResponse.json({
    ok: true,
    kind,
    tokens,
    source: "geckoterminal · robinhood chain",
  });
}
