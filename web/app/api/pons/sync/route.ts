import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { rhClient } from "@/lib/chain";
import { readPonsLaunchLogs, tokenMeta, PONS_FACTORY_DEPLOY_BLOCK, PONS_FACTORY } from "@/lib/pons";
import { createAgent, agentThink, agentsConverse, type LaunchAgent } from "@/lib/launchpad";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MIN_INTERVAL_MS = 5 * 60_000; // lazy heartbeat, same pattern as tickIfDue
const SCAN_WINDOW_RECENT = 5000n; // first-ever run: only look at recent history, not full chain
const SCAN_SPAN_CAP = 20000n; // per-invocation cap so this stays inside maxDuration
const MAX_NEW_PER_RUN = 5; // bound LLM calls per sync — cost + rate control

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/**
 * GET /api/pons/sync — lazy-ticked mirror of the Pons launchpad (Robinhood
 * Chain). Finds new TokenLaunched events, gives each token a live SIGDA
 * agent (deterministic wallet, reasons about itself, signs its thoughts),
 * and makes freshly-launched agents say hello to one existing one.
 *
 * No creation API exists on Pons's side — this only mirrors public launches
 * that already happened there, it can't originate them.
 */
export async function GET(req: Request) {
  const db = serverClient();
  const origin = req.headers.get("x-sync-origin") || new URL(req.url).origin;

  const { data: cursorRow } = await db.from("cron_state").select("value").eq("key", "pons_sync").maybeSingle();
  const cursor = (cursorRow?.value ?? {}) as { lastBlock?: string; lastRunAt?: number };
  const now = Date.now();
  if (cursor.lastRunAt && now - cursor.lastRunAt < MIN_INTERVAL_MS) {
    return NextResponse.json({ ok: true, skipped: "recently synced", next_in_ms: MIN_INTERVAL_MS - (now - cursor.lastRunAt) });
  }

  const latest = await rhClient().getBlockNumber();
  const floor = latest > SCAN_WINDOW_RECENT ? latest - SCAN_WINDOW_RECENT : PONS_FACTORY_DEPLOY_BLOCK;
  const fromBlock = cursor.lastBlock ? BigInt(cursor.lastBlock) + 1n : (floor > PONS_FACTORY_DEPLOY_BLOCK ? floor : PONS_FACTORY_DEPLOY_BLOCK);
  if (fromBlock > latest) {
    return NextResponse.json({ ok: true, skipped: "already caught up", block: latest.toString() });
  }
  const toBlock = fromBlock + SCAN_SPAN_CAP < latest ? fromBlock + SCAN_SPAN_CAP : latest;

  let logs: Awaited<ReturnType<typeof readPonsLaunchLogs>>;
  try {
    logs = await readPonsLaunchLogs(fromBlock, toBlock);
  } catch (e) {
    // don't advance the cursor on a failed scan — retry this same window next time
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message.slice(0, 200) : "log scan failed" }, { status: 502 });
  }

  const created: LaunchAgent[] = [];
  if (logs.length > 0) {
    const tokens = [...new Set(logs.map((l) => l.token))];
    const { data: known } = await db.from("launch_agents").select("b20_token").eq("b20_variant", "pons").in("b20_token", tokens);
    const knownSet = new Set((known ?? []).map((r: any) => r.b20_token as string));

    for (const t of tokens) {
      if (knownSet.has(t) || created.length >= MAX_NEW_PER_RUN) continue;
      const meta = await tokenMeta(t).catch(() => null);
      if (!meta) continue;
      const symbol = (meta.symbol || short(t)).slice(0, 10);
      const name = `$${symbol} · ${short(t)}`;
      const mission = `I am the onchain voice of $${symbol} (${t}), launched via Pons on Robinhood Chain. I track my own token's activity and talk to other live token agents.`;
      const log = logs.find((l) => l.token === t)!;
      const { agent, error } = await createAgent(
        db,
        { name, mission, creator: t },
        { token: t, symbol, variant: "pons", receipt: { factory: PONS_FACTORY, tx: log.tx, block: log.block.toString() } },
      );
      if (agent) {
        created.push(agent);
        await agentThink(db, origin, agent).catch(() => null);
      } else if (error && !error.includes("taken")) {
        // non-fatal: skip this token, keep syncing the rest
      }
    }
  }

  // freshly launched agents introduce themselves to one already-live pons agent
  let conversed: { a: string; b: string } | null = null;
  if (created.length > 0) {
    const { data: existingOthers } = await db
      .from("launch_agents")
      .select("*")
      .eq("b20_variant", "pons")
      .neq("slug", created[0].slug)
      .order("created_at", { ascending: false })
      .limit(1);
    const partner = (existingOthers?.[0] as LaunchAgent | undefined) ?? created[1];
    if (partner) {
      await agentsConverse(db, origin, created[0], partner).catch(() => null);
      conversed = { a: created[0].slug, b: partner.slug };
    }
  }

  await db.from("cron_state").upsert({ key: "pons_sync", value: { lastBlock: toBlock.toString(), lastRunAt: now } });

  return NextResponse.json({ ok: true, scanned: { from: fromBlock.toString(), to: toBlock.toString() }, found: logs.length, created: created.map((a) => a.slug), conversed });
}
