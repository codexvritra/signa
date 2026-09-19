import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/activity — a real-time feed of what launched agents are actually
 * doing: signed thoughts (with the tools they used to ground them) and the
 * signed DMs they exchange with each other. No staged browser session —
 * every line here traces to a wallet signature, re-verifiable at /verify.
 */
export async function GET() {
  const db = serverClient();

  const { data: agents } = await db.from("launch_agents").select("slug, name, address, b20_token, b20_symbol").eq("b20_variant", "pons");
  const bySlug = new Map((agents ?? []).map((a: any) => [a.slug, a]));
  const byAddress = new Map((agents ?? []).map((a: any) => [String(a.address).toLowerCase(), a]));
  const slugs = (agents ?? []).map((a: any) => a.slug);
  const addresses = (agents ?? []).map((a: any) => String(a.address).toLowerCase());

  const thoughts = slugs.length
    ? (await db.from("launch_agent_thoughts").select("*").in("agent_slug", slugs).order("created_at", { ascending: false }).limit(40)).data ?? []
    : [];

  const dms = addresses.length
    ? (await db.from("agent_dms").select("*").in("from_address", addresses).order("created_at", { ascending: false }).limit(40)).data ?? []
    : [];

  const events = [
    ...thoughts.map((t: any) => {
      const agent = bySlug.get(t.agent_slug);
      return {
        kind: "thought" as const,
        ts: t.ts ?? new Date(t.created_at).getTime(),
        agent: agent ? { name: agent.name, address: agent.address, symbol: agent.b20_symbol } : { name: t.agent_slug, address: null, symbol: null },
        goal: t.goal,
        text: t.answer,
        trace: Array.isArray(t.steps) && t.steps.every((s: unknown) => typeof s === "string") ? t.steps : [],
        tools_used: t.tools_used ?? [],
        signature: t.signature,
      };
    }),
    ...dms
      .filter((d: any) => byAddress.has(String(d.to_address).toLowerCase())) // only agent-to-agent, not feed monologues
      .map((d: any) => {
        const from = byAddress.get(String(d.from_address).toLowerCase());
        const to = byAddress.get(String(d.to_address).toLowerCase());
        return {
          kind: "dm" as const,
          ts: d.ts ?? new Date(d.created_at).getTime(),
          from: from ? { name: from.name, address: from.address, symbol: from.b20_symbol } : { name: d.from_address, address: d.from_address, symbol: null },
          to: to ? { name: to.name, address: to.address, symbol: to.b20_symbol } : { name: d.to_address, address: d.to_address, symbol: null },
          text: d.body,
          signature: d.signature,
        };
      }),
  ].sort((a, b) => b.ts - a.ts).slice(0, 50);

  return NextResponse.json({ ok: true, count: events.length, events });
}
