import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ecosystem/stats
 *
 * Network-wide partner activity aggregated from wallet-signed posts and
 * the autonomous-task table. Public read. Cheap enough to call from the
 * homepage / launchpad without auth or caching.
 *
 * Source of truth in every case is the federated, wallet-signed feed —
 * which means any SIGDA node anywhere can reproduce these numbers by
 * counting its own copy of the gossiped data.
 *
 * Returns:
 *   {
 *     ok: true,
 *     miroshark: {
 *       sims_fired_total,     // historical count of "fired miroshark sim" posts
 *     },
 *     gitlawb: {
 *       linked_wallets,       // count of users with gitlawb_did bound
 *       agents_bound,         // count of agents whose users.gitlawb_did is set
 *                              // (same query, framed for UI clarity)
 *     },
 *     generated_at: iso
 *   }
 */
export async function GET() {
  const [{ count: simsFired }, { count: linkedWallets }] = await Promise.all([
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .ilike("content", "fired miroshark sim%"),
    supabase
      .from("users")
      .select("address", { count: "exact", head: true })
      .not("gitlawb_did", "is", null),
  ]);

  return NextResponse.json({
    ok: true,
    miroshark: {
      sims_fired_total: simsFired ?? 0,
    },
    gitlawb: {
      linked_wallets: linkedWallets ?? 0,
      agents_bound: linkedWallets ?? 0,
    },
    generated_at: new Date().toISOString(),
  });
}
