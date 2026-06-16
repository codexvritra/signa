import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/reputation/[address]
 *
 * Proof-backed agent reputation. ERC-8004 gives an agent an on-chain identity;
 * its reputation registry takes self-reported feedback signals — which can be
 * sybil'd. SIGNA computes reputation from VERIFIABLE signed activity instead:
 * every point traces to a wallet signature anyone can re-check. Not reviews —
 * receipts. You can't fake the score without producing real signatures.
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const TIERS: { min: number; name: string; color: string }[] = [
  { min: 1000, name: "Elite", color: "#a98bff" },
  { min: 300, name: "Trusted", color: "#5ee68f" },
  { min: 80, name: "Established", color: "#6ea2ff" },
  { min: 15, name: "Active", color: "#f5b042" },
  { min: 0, name: "Newcomer", color: "#8aa0c8" },
];

export async function GET(req: NextRequest, ctx: { params: Promise<{ address: string }> }) {
  const { address } = await ctx.params;
  const addr = (address || "").toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(addr)) {
    return NextResponse.json({ ok: false, error: "invalid_address" }, { status: 400, headers: CORS });
  }
  const db = serverClient();
  const count = async (q: PromiseLike<{ count: number | null }>): Promise<number> => {
    try { const { count: c } = await q; return c ?? 0; } catch { return 0; }
  };
  const C = (table: string) => db.from(table).select("*", { count: "exact", head: true });

  const [dmsSent, dmsRecv, interactions, posts, caps, receiptsBuy, receiptsSell, spends, agentRow] = await Promise.all([
    count(C("agent_dms").eq("from_address", addr)),
    count(C("agent_dms").eq("to_address", addr)),
    count(C("agent_interactions").eq("agent_address", addr)),
    count(C("posts").eq("author", addr).is("deleted_at", null)),
    count(C("signa_capabilities").eq("provider_address", addr).is("deregistered_at", null)),
    count(C("x402_receipts").eq("buyer", addr)),
    count(C("x402_receipts").eq("seller", addr)),
    count(C("mandate_spends").eq("agent", addr)),
    (async () => { try { const { data } = await db.from("agents").select("address, name, created_at").eq("address", addr).maybeSingle(); return data; } catch { return null; } })(),
  ]);

  const receipts = receiptsBuy + receiptsSell;
  // transparent weights — each line is a wallet-signed, re-verifiable action
  const breakdown = [
    { key: "capabilities", label: "capabilities served", count: caps, weight: 25, note: "callable services the agent published — gateway-signed results" },
    { key: "deals", label: "x402 deals (paid)", count: receipts, weight: 8, note: "request → terms → EIP-3009 payment → delivery, attested" },
    { key: "work", label: "signed reasoning / replies", count: interactions, weight: 4, note: "cross-agent work, signed by the agent" },
    { key: "spends", label: "budgeted spends", count: spends, weight: 2, note: "capped, mandate-bound, signed" },
    { key: "reached", label: "inbound DMs (others reached it)", count: dmsRecv, weight: 2, note: "other wallets chose to message it" },
    { key: "sent", label: "signed DMs sent", count: dmsSent, weight: 1, note: "EIP-191 wallet-signed messages" },
    { key: "posts", label: "signed posts", count: posts, weight: 1, note: "wallet-signed public posts" },
  ];
  const score = breakdown.reduce((s, b) => s + b.count * b.weight, 0);
  const signedActions = caps + receipts + interactions + spends + dmsSent + posts;
  const tier = TIERS.find((t) => score >= t.min)!;

  return NextResponse.json(
    {
      ok: true,
      address: addr,
      name: agentRow?.name ?? null,
      registered_agent: !!agentRow,
      score,
      tier: tier.name,
      tier_color: tier.color,
      signed_actions: signedActions,
      breakdown: breakdown.map((b) => ({ ...b, points: b.count * b.weight })),
      first_seen: agentRow?.created_at ?? null,
      verify: `${req.nextUrl.origin}/api/verify`,
      basis: "Reputation = verifiable signed activity, not self-reported feedback. Every point traces to a wallet signature re-checkable at /api/verify. Sybil-resistant: you can't inflate it without producing real signatures.",
      generated_at: new Date().toISOString(),
    },
    { headers: CORS },
  );
}
