import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { readLaunches, tokenFromReceipt, tokenChainState, launchFeeWei, pumpLive, SIGNA_PUMP_ADDRESS, RH_CHAIN_ID } from "@/lib/pump";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/pump — SignaPump bonding-curve launchpad on Robinhood Chain.
 *   GET               → launched tokens (chain launches merged with metadata) + config
 *   GET ?token=0x…    → one token: metadata + live curve state (raised/threshold/price)
 *   POST { launch_tx, name, symbol, description?, image_url?, telegram?, twitter?, website? }
 *        → save metadata (token + creator are resolved from the launch tx, so only real launches stick)
 */
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type" } as const;
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }
const clip = (s: unknown, n: number) => String(s ?? "").slice(0, n);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const token = sp.get("token");
  const db = serverClient();

  if (token) {
    const t = token.toLowerCase();
    const { data: meta } = await db.from("pump_tokens").select("*").eq("token", t).maybeSingle();
    const chain = await tokenChainState(t);
    return NextResponse.json({ ok: true, token: t, meta: meta ?? null, chain }, { headers: CORS });
  }

  const [launches, { data: metas }] = await Promise.all([
    readLaunches(100),
    db.from("pump_tokens").select("*").order("created_at", { ascending: false }).limit(200),
  ]);
  const metaByToken = new Map((metas ?? []).map((m: any) => [String(m.token).toLowerCase(), m]));
  // merge: prefer on-chain launches (source of truth), enrich with metadata; include metadata-only rows too
  const seen = new Set<string>();
  const tokens = launches.map((l) => { seen.add(l.token); return { ...l, meta: metaByToken.get(l.token) ?? null }; });
  for (const m of metas ?? []) if (!seen.has(String(m.token).toLowerCase())) tokens.push({ token: String(m.token).toLowerCase(), creator: m.creator, name: m.name, symbol: m.symbol, timestamp: 0, tx: m.launch_tx, block: "0", meta: m } as any);

  return NextResponse.json({ ok: true, live: pumpLive, contract: SIGNA_PUMP_ADDRESS || null, chain_id: RH_CHAIN_ID, launch_fee_wei: await launchFeeWei(), count: tokens.length, tokens }, { headers: CORS });
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const db = serverClient();
  const launch_tx = String(b.launch_tx ?? "");

  // Resolve token + creator from the launch tx — only real SignaPump launches get metadata.
  const resolved = await tokenFromReceipt(launch_tx);
  if (!resolved) return NextResponse.json({ ok: false, error: pumpLive ? "launch_not_found_for_tx" : "pump_not_deployed" }, { status: 400, headers: CORS });

  const row = {
    token: resolved.token,
    creator: resolved.creator,
    name: clip(b.name || resolved.name, 64),
    symbol: clip(b.symbol || resolved.symbol, 16),
    description: clip(b.description, 2000),
    image_url: clip(b.image_url, 400),
    telegram: clip(b.telegram, 200),
    twitter: clip(b.twitter, 200),
    website: clip(b.website, 200),
    launch_tx,
  };
  const { error } = await db.from("pump_tokens").upsert(row, { onConflict: "token" });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400, headers: CORS });
  return NextResponse.json({ ok: true, token: resolved.token }, { headers: CORS });
}
