import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { tick, consistencyFor } from "@/lib/transparency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/log/consistency?first=<earlier tree_size>
 *
 * RFC 6962 consistency proof between an earlier log size and the current head.
 * Proves the earlier tree is a PREFIX of the current tree — i.e. the log is
 * append-only and no historical entry was rewritten. Verify offline with the
 * two roots + the proof (RFC 6962 §2.1.2).
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
  const first = Number(req.nextUrl.searchParams.get("first") ?? "0");
  if (!Number.isInteger(first) || first <= 0) {
    return NextResponse.json({ ok: false, error: "first_must_be_positive_integer" }, { status: 400, headers: CORS });
  }
  const db = serverClient();
  try {
    await tick(db, Date.now());
  } catch {
    /* use latest checkpoint as-is */
  }
  const res = await consistencyFor(db, first);
  if (!res) {
    return NextResponse.json(
      { ok: false, error: "out_of_range", hint: "first must be 1..current tree_size, and at least one checkpoint must exist" },
      { status: 400, headers: CORS },
    );
  }
  return NextResponse.json(
    { ok: true, ...res, verify: { algorithm: "RFC 6962 §2.1.2", how: "verifyConsistency(first, second, first_root, second_root, proof)" } },
    { headers: CORS },
  );
}
