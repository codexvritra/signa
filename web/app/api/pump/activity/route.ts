import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { pumpActivity, pumpLive } from "@/lib/pump";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/pump/activity — recent launchpad activity (buys, sells, launches,
 * graduations) across all coins, enriched with token symbol/image. Drives the
 * live notification toasts + ticker.
 */
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "content-type" } as const;
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

export async function GET() {
  const items = await pumpActivity(40);
  const tokens = [...new Set(items.map((i) => i.token))];
  const meta = new Map<string, { symbol: string; image_url: string }>();
  if (tokens.length) {
    const { data } = await serverClient().from("pump_tokens").select("token, symbol, image_url").in("token", tokens);
    for (const m of data ?? []) meta.set(String(m.token).toLowerCase(), { symbol: m.symbol, image_url: m.image_url });
  }
  const activity = items.map((i) => ({ ...i, symbol: meta.get(i.token)?.symbol || "", image_url: meta.get(i.token)?.image_url || "" }));
  return NextResponse.json({ ok: true, live: pumpLive, count: activity.length, activity }, { headers: CORS });
}
