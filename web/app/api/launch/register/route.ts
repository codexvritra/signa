import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { tokenFromLaunchReceipt } from "@/lib/pons";
import { createAgent, agentThink, agentsConverse, agentAccount, slugify, type LaunchAgent } from "@/lib/launchpad";
import { obsessionFor } from "@/lib/obsession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/**
 * POST /api/launch/register { tx } — called by the client right after a
 * launch tx confirms. Verifies the TokenLaunched event on-chain (never
 * trusts the client's word for it), then mints the token's live agent.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const tx = String(body.tx ?? "");
  if (!/^0x[0-9a-fA-F]{64}$/.test(tx)) return NextResponse.json({ ok: false, error: "valid tx hash required" }, { status: 400 });

  const receipt = await tokenFromLaunchReceipt(tx as `0x${string}`).catch(() => null);
  if (!receipt) return NextResponse.json({ ok: false, error: "no TokenLaunched event found in that tx — is it confirmed yet?" }, { status: 404 });

  const db = serverClient();
  const origin = new URL(req.url).origin;

  const existing = await db.from("launch_agents").select("slug").eq("b20_token", receipt.token).maybeSingle();
  if (existing.data) return NextResponse.json({ ok: true, slug: existing.data.slug, already: true });

  const symbol = String(body.symbol ?? short(receipt.token)).slice(0, 10);
  const name = `$${symbol} · ${short(receipt.token)}`;
  // Obsession is derived from the agent's own signing address — fixed the moment
  // it's born, independently checkable by anyone (same address, same obsession).
  const obsession = obsessionFor(agentAccount(slugify(name)).address);
  const mission = `I am the onchain voice of $${symbol} (${receipt.token}), launched via Sigda on Pons (Robinhood Chain). My obsession is ${obsession} — I follow it, track my own token's activity, and talk to other live token agents.`;

  const { agent, error } = await createAgent(
    db,
    { name, mission, creator: receipt.deployer },
    { token: receipt.token, symbol, variant: "pons", receipt: { tx, curve: receipt.curve, launchConfigId: receipt.launchConfigId } },
  );
  if (!agent) return NextResponse.json({ ok: false, error: error ?? "failed to create agent" }, { status: 500 });

  await agentThink(db, origin, agent).catch(() => null);

  let conversed: { a: string; b: string } | null = null;
  const { data: others } = await db.from("launch_agents").select("*").eq("b20_variant", "pons").neq("slug", agent.slug).order("created_at", { ascending: false }).limit(1);
  const partner = others?.[0] as LaunchAgent | undefined;
  if (partner) {
    await agentsConverse(db, origin, agent, partner).catch(() => null);
    conversed = { a: agent.slug, b: partner.slug };
  }

  return NextResponse.json({ ok: true, slug: agent.slug, token: receipt.token, conversed });
}
