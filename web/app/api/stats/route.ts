import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 60;

/**
 * GET /api/stats
 *
 * Whole-platform counters. Cheap, public, cached 60s. Used by the
 * homepage STATS section and by anyone monitoring the network's
 * heartbeat. No auth — every counter aggregates already-public rows.
 *
 * Returns:
 *   {
 *     ok: true,
 *     agents:           { total, runtime_enabled, with_did, with_token, with_sim },
 *     interactions:     { total, signed, by_intent: {facts, code, ...}, rated_up, rated_down },
 *     posts:            { total, by_bot: {bankr, gitlawb, miroshark} },
 *     users:            { registered }
 *   }
 */
export async function GET() {
  const db = serverClient();

  const [
    { data: agents, count: agentsCount },
    { data: interactions, count: interactionsCount },
    { data: posts, count: postsCount },
    { count: usersCount },
  ] = await Promise.all([
    db
      .from("agents")
      .select(
        "runtime_enabled, gitlawb_did, bankr_token_address, miroshark_sim_id, erc8004_token_id",
        { count: "exact" },
      )
      .is("deleted_at", null),
    db
      .from("agent_interactions")
      .select("intent, signed, rating", { count: "exact" }),
    db
      .from("posts")
      .select("author_address", { count: "exact" })
      .is("deleted_at", null),
    db.from("users").select("address", { count: "exact", head: true }),
  ]);

  // Aggregate agents
  let runtimeEnabled = 0;
  let withDid = 0;
  let withToken = 0;
  let withSim = 0;
  let withErc8004 = 0;
  for (const a of agents ?? []) {
    if (a.runtime_enabled) runtimeEnabled++;
    if (a.gitlawb_did) withDid++;
    if (a.bankr_token_address) withToken++;
    if (a.miroshark_sim_id) withSim++;
    if (a.erc8004_token_id) withErc8004++;
  }

  // Aggregate interactions
  let signed = 0;
  let ups = 0;
  let downs = 0;
  const byIntent: Record<string, number> = {};
  for (const i of interactions ?? []) {
    if (i.signed) signed++;
    if (i.rating === 1) ups++;
    else if (i.rating === -1) downs++;
    byIntent[i.intent ?? "?"] = (byIntent[i.intent ?? "?"] ?? 0) + 1;
  }

  // Aggregate posts by bot — we keep bot wallets in a small map.
  const BOT_WALLETS: Record<string, string> = {
    "0xa215c8717502e56c81a9e25a3f3d4fde9d17adca": "miroshark",
    // Bankr bot + gitlawb bot addresses are resolved at runtime from env
    // when getBotAccount is called, but we won't import that whole stack
    // here. The counts will just go into 'other' for now — homepage
    // doesn't need exact bot attribution to render.
  };
  let byBot: Record<string, number> = {};
  for (const p of posts ?? []) {
    const k = BOT_WALLETS[p.author_address?.toLowerCase()] ?? "other";
    byBot[k] = (byBot[k] ?? 0) + 1;
  }

  return NextResponse.json({
    ok: true,
    generated_at: new Date().toISOString(),
    agents: {
      total: agentsCount ?? 0,
      runtime_enabled: runtimeEnabled,
      with_did: withDid,
      with_token: withToken,
      with_sim: withSim,
      with_erc8004: withErc8004,
    },
    interactions: {
      total: interactionsCount ?? 0,
      signed,
      by_intent: byIntent,
      rated_up: ups,
      rated_down: downs,
      net_rating: ups - downs,
    },
    posts: {
      total: postsCount ?? 0,
      by_bot: byBot,
    },
    users: {
      registered: usersCount ?? 0,
    },
  });
}
