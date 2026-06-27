import { NextResponse } from "next/server";
import { b20Status } from "@/lib/b20";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/b20/status — the honest, live activation state of B20 on Base mainnet.
 * Pure eth_call probe (no gas): does the precompile answer reads, and is createB20
 * actually callable yet? Powers the public "is B20 live?" tracker.
 */
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "content-type" } as const;
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

export async function GET() {
  try {
    const s = await b20Status();
    return NextResponse.json({ ok: true, ...s }, { headers: CORS });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "probe failed" }, { status: 502, headers: CORS });
  }
}
