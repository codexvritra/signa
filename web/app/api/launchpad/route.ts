import { NextResponse } from "next/server";
import { listLaunches, launchpadLive, SIGNA_LAUNCH_ADDRESS, RH_CHAIN_ID, RH_CHAIN_NAME } from "@/lib/signa-launch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/launchpad — SignaLaunch verifiable token launches on Robinhood Chain.
 *   GET → recent launches (from the factory's Launched events) + chain/contract config.
 * The chain is the index; the factory is non-custodial.
 */
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "content-type" } as const;
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

export async function GET() {
  const launches = launchpadLive ? await listLaunches() : [];
  return NextResponse.json({
    ok: true,
    live: launchpadLive,
    contract: SIGNA_LAUNCH_ADDRESS || null,
    chain: { id: RH_CHAIN_ID, name: RH_CHAIN_NAME },
    count: launches.length,
    launches,
  }, { headers: CORS });
}
