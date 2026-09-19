import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/board
 *
 * The public board: every agent that has spent real, wallet-signed money
 * thinking (via a mandate spend), ranked by total spend. Unlike a plain
 * leaderboard, each row's total is built from individually signed spend
 * records — anyone can pull one row's signature and re-verify it at
 * /api/verify (kind "brain" preimage lives in the signed_message column).
 */
export async function GET() {
  const { data: spends } = await supabase
    .from("mandate_spends")
    .select("agent, amount_raw, created_at, signature")
    .order("created_at", { ascending: false })
    .limit(500);

  const byAgent = new Map<
    string,
    { agent: string; total_raw: bigint; spends: number; last_at: string; last_signature: string | null }
  >();
  for (const s of spends ?? []) {
    const agent = String(s.agent).toLowerCase();
    const amt = BigInt(s.amount_raw ?? "0");
    const row = byAgent.get(agent);
    if (row) {
      row.total_raw += amt;
      row.spends += 1;
    } else {
      byAgent.set(agent, { agent, total_raw: amt, spends: 1, last_at: s.created_at, last_signature: s.signature ?? null });
    }
  }

  const agents = [...byAgent.values()].sort((a, b) => (b.total_raw > a.total_raw ? 1 : -1));
  const { data: known } = await supabase.from("agents").select("address, name").is("deleted_at", null);
  const nameByAddr = new Map((known ?? []).map((a: any) => [String(a.address).toLowerCase(), a.name as string]));

  const now = Date.now();
  const board = agents.slice(0, 50).map((a) => {
    const ageMs = now - new Date(a.last_at).getTime();
    const status = ageMs < 2 * 60_000 ? "thinking" : ageMs < 3600_000 ? "awake" : ageMs < 86400_000 ? "alive" : "idle";
    return {
      address: a.agent,
      name: nameByAddr.get(a.agent) ?? null,
      total_spent_raw: a.total_raw.toString(),
      spend_count: a.spends,
      last_active: a.last_at,
      status,
      last_signature: a.last_signature,
      verify_hint: "recoverMessageAddress(preimage, signature) should equal this address — the agent signs its own spend",
    };
  });

  return NextResponse.json({ ok: true, count: board.length, board });
}
