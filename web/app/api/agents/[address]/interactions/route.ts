import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/agents/[address]/interactions?cursor=…&limit=20
 *
 * Public, paged feed of one agent's Q&A history. Used by the
 * /agent/[address]/replies page and by anyone building a third-party
 * dashboard / Discord bot that wants to surface a SIGNA agent's track
 * record.
 *
 * Cursor pagination on created_at (descending) — cursor is the iso
 * timestamp of the last row in the previous page. Returns up to
 * `limit` (clamped 1..50) rows.
 *
 * Auth: none. Same model as the /respond endpoint — every reply is
 * already a public utterance by a public agent wallet, so the index
 * is public too.
 *
 * Also exposes simple aggregate stats (counts of each intent, sum of
 * ratings) so the page can render a header without a second query.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address: raw } = await params;
  const address = raw.toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "invalid_address" }, { status: 400 });
  }

  const limit = Math.min(
    50,
    Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 20)),
  );
  const cursor = req.nextUrl.searchParams.get("cursor");

  const db = serverClient();
  let q = db
    .from("agent_interactions")
    .select(
      "id, agent_address, sender_address, message, response, intent, sources, signed, rating, created_at",
    )
    .eq("agent_address", address)
    .order("created_at", { ascending: false })
    .limit(limit + 1);
  if (cursor) {
    q = q.lt("created_at", cursor);
  }
  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1]?.created_at ?? null : null;

  // Aggregate stats — cheap separate query, public.
  const { data: agg } = await db
    .from("agent_interactions")
    .select("intent, rating")
    .eq("agent_address", address);

  const intentCounts: Record<string, number> = {};
  let ups = 0;
  let downs = 0;
  for (const r of agg ?? []) {
    intentCounts[r.intent ?? "?"] = (intentCounts[r.intent ?? "?"] ?? 0) + 1;
    if (r.rating === 1) ups++;
    else if (r.rating === -1) downs++;
  }

  return NextResponse.json({
    ok: true,
    agent_address: address,
    interactions: page,
    next_cursor: nextCursor,
    stats: {
      total: (agg ?? []).length,
      intents: intentCounts,
      ups,
      downs,
      net: ups - downs,
    },
  });
}
