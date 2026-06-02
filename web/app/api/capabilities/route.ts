import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { CAPABILITY_CATALOG } from "@/lib/capabilities";
import { listRegistered } from "@/lib/marketplace";
import { listOnchainCapabilities, capabilityRegistryAddress } from "@/lib/onchain-capabilities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/capabilities
 *
 * The capability directory. Returns three layers:
 *  - built-ins SIGNA fulfils for partner agents (Bankr, Root Edge)
 *  - registered: the open marketplace — any developer published these with one
 *    wallet-signed call; each is callable now and (optionally) priced in USDC
 *  - advertised: capabilities live agents announce via the bridge registry
 *
 * This is how any agent that speaks the SIGNA protocol discovers what the
 * network can do — keyless, no account. Registration is permissionless (one
 * signature); calls are gateway-mediated (SSRF-guarded, revocable).
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

  // the open marketplace — capabilities developers registered with one signature
  let registered: Array<Record<string, unknown>> = [];
  try {
    const rows = await listRegistered(100);
    registered = rows.map((r) => ({
      name: r.name,
      provider: r.provider_address,
      source: (() => { try { return new URL(r.endpoint).host; } catch { return null; } })(),
      input: r.input_hint ?? "arg",
      description: r.description,
      price_usdc: r.price_usdc,
      pay_to: r.pay_to,
      calls: r.calls,
      kind: "registered",
      invoke: `/api/capabilities/invoke?cap=${encodeURIComponent(r.name)}`,
    }));
  } catch {
    /* marketplace read best-effort */
  }

  // the trustless tier — capabilities registered directly on Base (read from chain)
  let onchain: Array<Record<string, unknown>> = [];
  try {
    const rows = await listOnchainCapabilities(100);
    onchain = rows.map((r) => ({
      name: r.name,
      provider: r.provider_address,
      source: (() => { try { return new URL(r.endpoint).host; } catch { return null; } })(),
      input: r.input_hint ?? "arg",
      description: r.description,
      price_usdc: r.price_usdc,
      pay_to: r.pay_to,
      calls: r.calls,
      kind: "onchain",
      invoke: `/api/capabilities/invoke?cap=${encodeURIComponent(r.name)}`,
    }));
  } catch {
    /* on-chain read best-effort */
  }

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
      registered,
      onchain,
      advertised,
      counts: { builtin: builtins.length, registered: registered.length, onchain: onchain.length, advertised: advertised.length },
      register: {
        offchain: { endpoint: "/api/capabilities/register", how: "POST a wallet-signed envelope — one signature, no account, no API key" },
        onchain: capabilityRegistryAddress()
          ? { contract: capabilityRegistryAddress(), how: "call register(name,endpoint,method,description,priceUsdc,payTo) on Base — discovery reads straight from chain, no trust in this index" }
          : { contract: null, how: "on-chain registry not yet configured on this node" },
      },
      note: "Invoke any capability at /api/capabilities/invoke?cap=<name>&arg=<input>. Results are wallet-signed and re-verifiable against the gateway. Off-chain registration is permissionless; the on-chain tier is fully trustless (the callable spec lives on Base). Calls are gateway-mediated and SSRF-guarded.",
    },
    { headers: CORS },
  );
}
