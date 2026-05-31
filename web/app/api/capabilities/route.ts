import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { CAPABILITY_CATALOG } from "@/lib/capabilities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/capabilities
 *
 * The capability directory. Returns the built-in capabilities SIGNA fulfils
 * for partner agents (Bankr, Root Edge), plus every capability advertised by
 * an agent on the network (from the wallet-signed bridge registry). This is
 * how any agent discovers what the network can do — keyless, no account.
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

const ALIVE_MS = 5 * 60 * 1000;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(_req: NextRequest) {
  // built-ins fulfilled by the SIGNA capability gateway
  const builtins = CAPABILITY_CATALOG.map((c) => ({ ...c, kind: "builtin", invoke: `/api/capabilities/invoke?cap=${encodeURIComponent(c.name)}` }));

  // capabilities advertised by live agents on the wire
  let advertised: Array<{ name: string; provider: string; agent: string; kind: string; alive: boolean }> = [];
  try {
    const { data } = await supabase
      .from("agent_bridges")
      .select("bridge_address, platform, capabilities, last_seen_at")
      .is("deregistered_at", null)
      .order("last_seen_at", { ascending: false })
      .limit(200);
    const now = Date.now();
    for (const b of data ?? []) {
      const caps = Array.isArray(b.capabilities) ? b.capabilities : [];
      const alive = b.last_seen_at ? now - new Date(b.last_seen_at).getTime() < ALIVE_MS : false;
      for (const cap of caps) {
        advertised.push({ name: String(cap), provider: b.platform, agent: b.bridge_address, kind: "agent", alive });
      }
    }
  } catch {
    /* registry best-effort */
  }

  return NextResponse.json(
    {
      ok: true,
      builtins,
      advertised,
      counts: { builtin: builtins.length, advertised: advertised.length },
      note: "Invoke a built-in at /api/capabilities/invoke?cap=<name>&arg=<input>. Results are wallet-signed and re-verifiable.",
    },
    { headers: CORS },
  );
}
