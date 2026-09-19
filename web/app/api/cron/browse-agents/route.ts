import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { authorizeBearer } from "@/lib/secret-auth";
import { obsessionFor } from "@/lib/obsession";
import { fetchObsessionPage, reflectOnPage, browseInteractive } from "@/lib/browse";
import { recordThought, shareFinding, type LaunchAgent } from "@/lib/launchpad";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Autonomous research tick — the piece that makes agents actually alive
 * without anyone curling an endpoint. Runs on a schedule (see vercel.json),
 * picks the single least-recently-active launched agent, and has it really
 * browse: a live Browserbase session over CDP, a real click-through, a real
 * Groq reflection, shared with another agent. Bounded to ONE agent per run
 * — Browserbase sessions cost real money, so this is deliberately not
 * "tick everyone every time."
 */
export async function GET(req: NextRequest) {
  if (!authorizeBearer(req, "CRON_SECRET")) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const db = serverClient();
  const { data: candidates } = await db
    .from("launch_agents")
    .select("*")
    .eq("b20_variant", "pons")
    .order("last_tick_at", { ascending: true, nullsFirst: true })
    .limit(1);
  const agent = candidates?.[0] as LaunchAgent | undefined;
  if (!agent) return NextResponse.json({ ok: true, skipped: "no launched agents yet" });

  const obsession = obsessionFor(agent.address);
  let mode: string; let source: string; let fallback_reason: string | undefined;
  let t;
  try {
    const session = await browseInteractive(agent.name, obsession);
    t = await recordThought(db, agent, `browsed from ${obsession}`, session.answer, session.trace, ["browserbase.session"]);
    mode = "interactive"; source = session.finalUrl;
  } catch (interactiveErr) {
    const page = await fetchObsessionPage(obsession);
    if (!page) return NextResponse.json({ ok: false, error: "browsing unavailable" }, { status: 503 });
    const reflection = await reflectOnPage(agent.name, obsession, page);
    t = await recordThought(db, agent, `read ${page.url}`, reflection.answer, reflection.trace, ["browserbase.fetch"]);
    mode = "fetch_fallback"; source = page.url;
    fallback_reason = interactiveErr instanceof Error ? interactiveErr.message.slice(0, 150) : "interactive session failed";
  }

  let shared: { to: string } | null = null;
  const { data: others } = await db.from("launch_agents").select("*").eq("b20_variant", "pons").neq("slug", agent.slug).order("last_tick_at", { ascending: false }).limit(1);
  const partner = others?.[0] as LaunchAgent | undefined;
  if (partner) {
    await shareFinding(db, agent, partner, t.answer).catch(() => null);
    shared = { to: partner.slug };
  }

  return NextResponse.json({ ok: true, agent: agent.slug, obsession, mode, source, fallback_reason, shared });
}
