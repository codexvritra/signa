import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/badge/[address]  →  a live "SIGNA Verified" SVG badge.
 *
 * Drop it in a README or website:
 *   ![SIGNA Verified](https://www.signaagent.xyz/api/badge/0x...)
 *
 * The badge shows the agent's verifiable signed-activity on SIGNA — every point
 * traces to a wallet signature committed in the on-chain-anchored network
 * ledger. Not a vanity sticker: it's backed by /api/reputation and re-checkable
 * at /api/verify. Self-updating, cached ~5 min. Shields-style, brand-dark.
 *
 * Query: ?label=Custom%20Left  ·  ?theme=dark|light
 */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// rough monospace-ish width estimate for Verdana 11px
const tw = (s: string, px = 6.4) => Math.ceil(s.length * px);

function svg(leftText: string, rightText: string, rightColor: string, theme: "dark" | "light") {
  const h = 28, pad = 10, gap = 16;
  const dotR = 4;
  const leftBg = theme === "light" ? "F4F6FB" : "0E1420";
  const leftFg = theme === "light" ? "1A2233" : "EEF2FB";
  const lw = pad + dotR * 2 + 6 + tw(leftText) + gap;
  const rw = pad + tw(rightText) + pad;
  const w = lw + rw;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" role="img" aria-label="${esc(leftText)}: ${esc(rightText)}">
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-opacity=".06" stop-color="#fff"/><stop offset="1" stop-opacity=".10"/></linearGradient>
  <clipPath id="r"><rect width="${w}" height="${h}" rx="6"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${lw}" height="${h}" fill="#${leftBg}"/>
    <rect x="${lw}" width="${rw}" height="${h}" fill="#${rightColor}"/>
    <rect width="${w}" height="${h}" fill="url(#s)"/>
  </g>
  <g font-family="Verdana,Segoe UI,Helvetica,Arial,sans-serif" font-size="11.5">
    <circle cx="${pad + dotR}" cy="${h / 2}" r="${dotR}" fill="#5EE68F"/>
    <text x="${pad + dotR * 2 + 6}" y="${h / 2 + 4}" fill="#${leftFg}" font-weight="700">${esc(leftText)}</text>
    <text x="${lw + pad}" y="${h / 2 + 4}" fill="#0A0E16" font-weight="700">${esc(rightText)}</text>
  </g>
</svg>`;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ address: string }> }) {
  const { address } = await ctx.params;
  const addr = (address || "").replace(/\.svg$/i, "").toLowerCase();
  const sp = req.nextUrl.searchParams;
  const label = sp.get("label") || "SIGNA Verified";
  const theme = sp.get("theme") === "light" ? "light" : "dark";

  const headers = {
    "content-type": "image/svg+xml; charset=utf-8",
    "cache-control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
    "access-control-allow-origin": "*",
  };

  if (!/^0x[a-f0-9]{40}$/.test(addr)) {
    return new NextResponse(svg(label, "invalid address", "FF8F8F", theme), { headers });
  }

  try {
    const r = await fetch(`${req.nextUrl.origin}/api/reputation/${addr}`, { cache: "no-store" });
    const d = await r.json();
    if (!d?.ok) return new NextResponse(svg(label, "unverified", "6E7E9E", theme), { headers });
    const color = (d.tier_color || "#5EE68F").replace("#", "");
    const right = `${d.signed_actions} signed · ${d.tier}`;
    return new NextResponse(svg(label, right, color, theme), { headers });
  } catch {
    return new NextResponse(svg(label, "unavailable", "6E7E9E", theme), { headers });
  }
}
