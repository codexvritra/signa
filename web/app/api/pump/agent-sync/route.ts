import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { readLaunches, pumpLive } from "@/lib/pump";
import { createAgent, agentThink, agentsConverse, type LaunchAgent } from "@/lib/launchpad";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MIN_INTERVAL_MS = 5 * 60_000; // lazy heartbeat, same pattern as tickIfDue
const MAX_NEW_PER_RUN = 5; // bound LLM calls per sync — cost + rate control

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/**
 * GET /api/pump/agent-sync — lazy-ticked: every token launched on Sigda's own
 * SignaPump gets a live agent (deterministic wallet, reasons about itself,
 * signs its thoughts) and greets one already-live launch agent.
 */
export async function GET(req: Request) {
  if (!pumpLive) {
    return NextResponse.json({ ok: true, skipped: "SignaPump has no deployed contract yet" });
  }

  const db = serverClient();
  const origin = req.headers.get("x-sync-origin") || new URL(req.url).origin;

  const { data: cursorRow } = await db.from("cron_state").select("value").eq("key", "pump_agent_sync").maybeSingle();
  const cursor = (cursorRow?.value ?? {}) as { lastRunAt?: number };
  const now = Date.now();
  if (cursor.lastRunAt && now - cursor.lastRunAt < MIN_INTERVAL_MS) {
    return NextResponse.json({ ok: true, skipped: "recently synced", next_in_ms: MIN_INTERVAL_MS - (now - cursor.lastRunAt) });
  }

  const chainLaunches = await readLaunches(200).catch(() => []);
  const created: LaunchAgent[] = [];

  if (chainLaunches.length > 0) {
    const tokens = chainLaunches.map((l) => l.token);
    const { data: known } = await db.from("launch_agents").select("b20_token").eq("b20_variant", "signapump").in("b20_token", tokens);
    const knownSet = new Set((known ?? []).map((r: any) => r.b20_token as string));

    for (const l of chainLaunches) {
      if (knownSet.has(l.token) || created.length >= MAX_NEW_PER_RUN) continue;
      const symbol = (l.symbol || short(l.token)).slice(0, 10);
      const name = `$${symbol} · ${short(l.token)}`;
      const mission = `I am the onchain voice of $${symbol} (${l.token}), launched on Sigda's own launchpad on Robinhood Chain. I track my own token's activity and talk to other live token agents.`;
      const { agent } = await createAgent(
        db,
        { name, mission, creator: l.creator },
        { token: l.token, symbol, variant: "signapump", receipt: { tx: l.tx, block: l.block } },
      );
      if (agent) {
        created.push(agent);
        await agentThink(db, origin, agent).catch(() => null);
      }
    }
  }

  let conversed: { a: string; b: string } | null = null;
  if (created.length > 0) {
    const { data: existingOthers } = await db
      .from("launch_agents")
      .select("*")
      .eq("b20_variant", "signapump")
      .neq("slug", created[0].slug)
      .order("created_at", { ascending: false })
      .limit(1);
    const partner = (existingOthers?.[0] as LaunchAgent | undefined) ?? created[1];
    if (partner) {
      await agentsConverse(db, origin, created[0], partner).catch(() => null);
      conversed = { a: created[0].slug, b: partner.slug };
    }
  }

  await db.from("cron_state").upsert({ key: "pump_agent_sync", value: { lastRunAt: now } });

  return NextResponse.json({ ok: true, scanned: chainLaunches.length, created: created.map((a) => a.slug), conversed });
}
