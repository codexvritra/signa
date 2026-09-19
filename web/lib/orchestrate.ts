import type { SupabaseClient } from "@supabase/supabase-js";
import { pickAgentToAct, runBrowseAction, findPartner } from "./browse";
import { recall } from "./memory";
import { decideNextAction } from "./decide";
import { makePrediction, ownTrackRecord } from "./predictions";
import { shareFinding } from "./launchpad";

export type ActResult = { agent: string; action: string; reason: string; detail?: string };

/**
 * The real Phase 4 entry point: pick whichever agent is due, let IT decide
 * what to do this cycle (browse / predict / message / idle), then execute
 * that specific choice. Replaces the always-on worker's old hardcoded
 * "browse every cycle, predict every 3rd" script.
 */
export async function autoActTick(db: SupabaseClient): Promise<ActResult | null> {
  const agent = await pickAgentToAct(db, 0);
  if (!agent) return null;

  const [memories, track, partner] = await Promise.all([
    recall(db, agent.slug).catch(() => []),
    ownTrackRecord(db, agent.slug).catch(() => []),
    findPartner(db, agent),
  ]);

  const decision = await decideNextAction(agent, memories, track, !!partner);

  switch (decision.action) {
    case "browse": {
      const result = await runBrowseAction(db, agent, memories);
      if (result && partner) await shareFinding(db, agent, partner, result.finding).catch(() => null);
      return { agent: agent.slug, action: "browse", reason: decision.reason, detail: result?.mode };
    }
    case "predict": {
      const result = await makePrediction(db, agent);
      // Predicting alone doesn't update last_tick_at (that happens inside
      // recordThought/agentThink) — touch it here so the round-robin still
      // rotates fairly even on a cycle where the agent chose not to browse.
      await db.from("launch_agents").update({ last_tick_at: new Date().toISOString() }).eq("slug", agent.slug);
      return { agent: agent.slug, action: "predict", reason: decision.reason, detail: result.ok ? `${result.prediction.ticker} ${result.prediction.direction}` : result.error };
    }
    case "message": {
      if (!partner) return { agent: agent.slug, action: "idle", reason: "wanted to message but no partner exists" };
      const note = memories[0] ?? `still thinking about my mission: ${agent.mission}`;
      await shareFinding(db, agent, partner, note).catch(() => null);
      await db.from("launch_agents").update({ last_tick_at: new Date().toISOString() }).eq("slug", agent.slug);
      return { agent: agent.slug, action: "message", reason: decision.reason, detail: `to ${partner.slug}` };
    }
    default:
      await db.from("launch_agents").update({ last_tick_at: new Date().toISOString() }).eq("slug", agent.slug);
      return { agent: agent.slug, action: "idle", reason: decision.reason };
  }
}
