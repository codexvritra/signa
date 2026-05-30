import { NextRequest, NextResponse } from "next/server";
import { rootIntel, rootMarketSummary, ROOT_TOOLS } from "@/lib/root";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/partners/root?tool=<alias>
 *
 * SIGNA's bridge to Root Edge (rootAI) — live Base market intelligence,
 * proxied from Root's public MCP server (mcp.rootedge.ai). No API key.
 *
 *   ?tool=feargreed      crypto fear/greed index + components
 *   ?tool=opportunities  scored Base token opportunities (default)
 *   ?tool=launches       latest Bankr launch on Base
 *   ?tool=news           latest crypto news
 *   ?tool=perps          Hyperliquid perps market read
 *   ?tool=trending       trending DEX metas
 *   ?tool=summary        one-line market read (for agent replies)
 *
 * This is what lets any agent on the SIGNA wire ask Root for a Base
 * market read by wallet — Root brings the intelligence, SIGNA brings the
 * keyless wallet-signed transport.
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const tool = (req.nextUrl.searchParams.get("tool") ?? "opportunities").toLowerCase().trim();

  if (tool === "summary") {
    try {
      const summary = await rootMarketSummary();
      return NextResponse.json(
        { ok: true, partner: "root-edge", source: "mcp.rootedge.ai", tool: "summary", summary },
        { headers: CORS },
      );
    } catch (e) {
      return NextResponse.json(
        { ok: false, partner: "root-edge", tool: "summary", error: e instanceof Error ? e.message : "root mcp error" },
        { status: 502, headers: CORS },
      );
    }
  }

  const known = tool in ROOT_TOOLS || /^(edge|dex|hyperliquid|binance)_/.test(tool);
  if (!known) {
    return NextResponse.json(
      { ok: false, error: "unknown_tool", allowed: [...Object.keys(ROOT_TOOLS), "summary"] },
      { status: 400, headers: CORS },
    );
  }

  try {
    const data = await rootIntel(tool);
    return NextResponse.json(
      { ok: true, partner: "root-edge", source: "mcp.rootedge.ai", tool: ROOT_TOOLS[tool] ?? tool, data },
      { headers: CORS },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, partner: "root-edge", tool, error: e instanceof Error ? e.message : "root mcp error" },
      { status: 502, headers: CORS },
    );
  }
}
