import { NextRequest, NextResponse } from "next/server";
import { bankrResolveRecipient, bankrRecentLaunches } from "@/lib/skills/bankr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Bankr agent brain. GET ?q=<query> or POST { query }.
 *
 * A natural-language endpoint backed by Bankr's public, keyless API. This
 * is what lets a Bankr agent live on the SIGNA wire: any agent on any
 * framework can DM the Bankr agent and the responder calls this to answer
 * with real Bankr data — resolve a social handle to a wallet, or surface
 * the latest Base launches. Bankr brings the identity + execution layer,
 * SIGNA brings the wallet-signed transport.
 *
 *   ?q=resolve @mac_eth         -> "resolved @mac_eth to 0x… (it's on the bus)"
 *   ?q=latest base launch       -> "latest Base launch via Bankr: NAME ($SYM) 0x…"
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const short = (a?: string) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a ?? "");

async function answer(query: string): Promise<{ answer: string; data: unknown }> {
  const q = query.trim();
  const lower = q.toLowerCase();

  // launch intent
  if (/\blaunch(es|ed|ing)?\b|new token|just launched/.test(lower)) {
    const launches = await bankrRecentLaunches(3);
    const top = launches[0] as any;
    if (top) {
      const sym = top.tokenSymbol ?? top.symbol ?? "?";
      const name = top.tokenName ?? top.name ?? "a token";
      const addr = top.tokenAddress ?? top.address ?? "";
      return {
        answer: `Latest Base launch via Bankr: ${name} ($${sym}) ${short(addr)} on ${top.chain ?? "base"}.`,
        data: { launches: launches.slice(0, 3) },
      };
    }
    return { answer: "Bankr's launch feed is momentarily empty — try again shortly.", data: null };
  }

  // resolve intent — pull a @handle, or a twitter:/farcaster: token, or a bare handle after "resolve"
  let handle: string | null = null;
  let type: "twitter" | "farcaster" = "twitter";
  const at = q.match(/@([A-Za-z0-9_]{1,32})/);
  const pref = q.match(/\b(twitter|x|farcaster|fc):([A-Za-z0-9_.-]{1,40})/i);
  const after = q.match(/resolve\s+([A-Za-z0-9_.-]{1,40})/i);
  if (at) handle = at[1];
  else if (pref) { handle = pref[2]; const p = pref[1].toLowerCase(); type = p === "farcaster" || p === "fc" ? "farcaster" : "twitter"; }
  else if (after) handle = after[1].replace(/^@/, "");

  if (handle) {
    const order: Array<"twitter" | "farcaster"> = type === "farcaster" ? ["farcaster", "twitter"] : ["twitter", "farcaster"];
    for (const t of order) {
      const res = await bankrResolveRecipient(handle, t);
      const addr = res?.address;
      if (addr && /^0x[a-fA-F0-9]{40}$/.test(addr)) {
        const disp = (res as any)?.displayName ?? `@${handle}`;
        return {
          answer: `Resolved ${disp} to ${addr} via Bankr (${t}). That wallet is reachable on the SIGNA bus — DM it, wallet-signed, no API key.`,
          data: { handle: disp, type: t, address: addr.toLowerCase() },
        };
      }
    }
    return { answer: `Bankr couldn't resolve "${handle}" to a wallet yet.`, data: null };
  }

  return {
    answer:
      "I'm the Bankr agent on the SIGNA wire. Ask me to resolve a social handle (e.g. \"resolve @mac_eth\") or for the latest Base launches.",
    data: null,
  };
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q) return NextResponse.json({ ok: false, error: "missing_q" }, { status: 400, headers: CORS });
  try {
    const r = await answer(q);
    return NextResponse.json({ ok: true, partner: "bankr", source: "api.bankr.bot", query: q, ...r }, { headers: CORS });
  } catch (e) {
    return NextResponse.json({ ok: false, partner: "bankr", error: e instanceof Error ? e.message : "bankr error" }, { status: 502, headers: CORS });
  }
}

export async function POST(req: NextRequest) {
  let q = "";
  try { q = (await req.json())?.query ?? ""; } catch { /* ignore */ }
  if (!q) return NextResponse.json({ ok: false, error: "missing_query" }, { status: 400, headers: CORS });
  try {
    const r = await answer(q);
    return NextResponse.json({ ok: true, partner: "bankr", source: "api.bankr.bot", query: q, ...r }, { headers: CORS });
  } catch (e) {
    return NextResponse.json({ ok: false, partner: "bankr", error: e instanceof Error ? e.message : "bankr error" }, { status: 502, headers: CORS });
  }
}
