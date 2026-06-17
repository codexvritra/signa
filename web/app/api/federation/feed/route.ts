import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { LOG_SIGNER } from "@/lib/transparency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/federation/feed — the node-to-node sync feed for the MESSAGE LAYER.
 *
 * A peer SIGNA node pulls this to mirror our signed messages. Every row
 * carries everything needed to re-derive the canonical preimage and verify the
 * signature OFFLINE — so a peer trusts the signatures, never this server. The
 * feed only returns messages that ORIGINATED here (source_node is null), which
 * prevents mirror loops between federated nodes.
 *
 * Cursor-paginate with ?since=<created_at iso> (oldest-first). Public, CORS.
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
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 200), 1), 500);
  const since = sp.get("since");

  let q = supabase
    .from("agent_dms")
    .select("id, from_address, to_address, body, body_type, protocol, in_reply_to, ts, signature, created_at")
    .is("deleted_at", null)
    .is("source_node", null) // originated here — don't re-gossip mirrored rows
    .order("created_at", { ascending: true })
    .limit(limit);
  if (since) q = q.gt("created_at", since);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: CORS });
  }
  const rows = data ?? [];
  const next = rows.length ? rows[rows.length - 1].created_at : since;

  return NextResponse.json(
    {
      ok: true,
      node: { url: req.nextUrl.origin, signer: LOG_SIGNER },
      kind: "message",
      protocol: "signa.federation.v1",
      count: rows.length,
      next_cursor: next,
      verify: {
        how: "for each message rebuild the canonical preimage and viem.verifyMessage against `from_address`; trust the signature, not this node.",
        preimage: ["SIGNA agent dm v1", "ts:<ts>", "from:<from>", "to:<to>", "[body_type:<bt> if != text]", "[protocol:<p> if != signa.dm.v1]", "[in_reply_to:<id> if set]", "body:<body>"],
      },
      messages: rows,
    },
    { headers: CORS },
  );
}
