import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { checkRoomGate, formatBalance } from "@/lib/room-gating";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/rooms/[slug]/gate-check?address=0x...
 *
 * Public preflight endpoint. Tells the UI whether `address` is currently
 * eligible to post in a gated room. Always returns 200 — the `eligible`
 * flag is what to look at. Anyone can read; no signature required because
 * this is just a balance peek.
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug: raw } = await params;
  const slug = (raw ?? "").toLowerCase();
  const address = (req.nextUrl.searchParams.get("address") ?? "").toLowerCase();

  if (!/^0x[a-f0-9]{40}$/.test(address)) {
    return NextResponse.json(
      { ok: false, error: "invalid_address" },
      { status: 400, headers: CORS },
    );
  }

  const { data: room, error } = await supabase
    .from("signa_rooms")
    .select(
      "creator_address, gate_token_address, gate_chain, gate_min_balance_raw, gate_token_symbol, gate_token_decimals",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500, headers: CORS },
    );
  if (!room)
    return NextResponse.json(
      { ok: false, error: "room_not_found" },
      { status: 404, headers: CORS },
    );

  // Ungated rooms — anyone with a wallet can post.
  if (!room.gate_token_address) {
    return NextResponse.json(
      { ok: true, gated: false, eligible: true },
      { status: 200, headers: CORS },
    );
  }

  const bypass = room.creator_address.toLowerCase() === address;
  const result = await checkRoomGate(
    address,
    {
      gate_token_address: room.gate_token_address,
      gate_chain: room.gate_chain,
      gate_min_balance_raw: room.gate_min_balance_raw,
      gate_token_symbol: room.gate_token_symbol,
      gate_token_decimals: room.gate_token_decimals,
    },
    bypass,
  );

  const minHuman = formatBalance(
    room.gate_min_balance_raw,
    room.gate_token_decimals,
  );
  const heldHuman =
    "heldRaw" in result && result.heldRaw
      ? formatBalance(result.heldRaw, room.gate_token_decimals)
      : undefined;

  return NextResponse.json(
    {
      ok: true,
      gated: true,
      eligible: result.ok,
      bypass,
      gate: {
        tokenAddress: room.gate_token_address,
        chain: room.gate_chain,
        symbol: room.gate_token_symbol,
        decimals: room.gate_token_decimals,
        minBalanceRaw: room.gate_min_balance_raw,
        minBalance: minHuman,
      },
      held: heldHuman ?? null,
      reason: result.ok ? null : (result as any).reason,
    },
    { status: 200, headers: CORS },
  );
}
