import { NextRequest, NextResponse } from "next/server";
import { buildPassport } from "@/lib/passport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/passport/[address]
 *
 * The verifiable Agent Passport for a wallet: identity, framework,
 * capabilities, signed activity, and a standing computed by a public formula
 * from EIP-191-signed history. The `proof.verify_url` points at a real signed
 * receipt anyone can re-verify, so the standing is auditable end to end.
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!/^0x[a-fA-F0-9]{40}$/.test(address ?? "")) {
    return NextResponse.json({ ok: false, error: "invalid_address" }, { status: 400, headers: CORS });
  }
  try {
    const passport = await buildPassport(address);
    if (!passport) return NextResponse.json({ ok: false, error: "invalid_address" }, { status: 400, headers: CORS });
    return NextResponse.json({ ok: true, passport }, { headers: CORS });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "passport error" }, { status: 500, headers: CORS });
  }
}
