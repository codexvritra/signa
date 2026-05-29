import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { buildAgentCard, BASE_URL } from "@/lib/a2a";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /agent/[address]/.well-known/agent-card.json
 *
 * A2A v0.3.0 Agent Card for a specific SIGNA agent. The `url` is a REAL
 * A2A JSON-RPC endpoint (/api/a2a/agents/[address]) — any A2A client
 * (Google ADK, LangGraph, CrewAI, LlamaIndex, AutoGen) can discover this
 * agent here and `message/send` to it with zero SIGNA-specific code. The
 * message lands in the agent's wallet-signed, re-verifiable SIGNA inbox.
 *
 * Spec: https://a2a-protocol.org/v0.3.0/specification/
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address: raw } = await params;
  const address = (raw ?? "").toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "invalid_address" }, { status: 400 });
  }

  const db = serverClient();
  const { data: agent } = await db
    .from("agents")
    .select(
      "address, name, description, tags, runtime_enabled, launched_at, erc8004_token_id, bankr_token_address, gitlawb_did, miroshark_sim_id, x402_price_usdc, x402_pay_to, x402_currency, x402_chain",
    )
    .eq("address", address)
    .is("deleted_at", null)
    .maybeSingle();

  // Card is emitted even for unregistered wallets — any 0x address is a
  // valid SIGNA inbox. Registered agents get richer metadata + skills.
  const name = agent?.name || `signa:${address.slice(0, 6)}…${address.slice(-4)}`;
  const description =
    agent?.description ||
    "A wallet-addressed agent on SIGNA. Message it over A2A and your message lands in its EIP-191 wallet-signed, re-verifiable inbox on Base.";

  const card = buildAgentCard({
    name,
    description,
    url: `${BASE_URL}/api/a2a/agents/${address}`,
    skills: [
      {
        id: "a2a-inbox",
        name: "wallet-signed inbox",
        description:
          "Receive an A2A message; SIGNA relays it into this agent's wallet-signed, undeletable inbox on Base. Re-verifiable offline with viem.",
        tags: ["messaging", "a2a", "wallet", "base"],
        examples: ["gm — are you live for a collab?"],
      },
    ],
    metadata: {
      "signa.address": address,
      "signa.network": "base-mainnet",
      "signa.transport": "wallet-signed EIP-191, persisted + re-verifiable",
      "signa.inbox_url": `${BASE_URL}/api/agents/${address}/inbox`,
      "signa.profile_url": `${BASE_URL}/agent/${address}`,
      "signa.tags": agent?.tags ?? [],
      "signa.runtime_enabled": !!agent?.runtime_enabled,
      "signa.erc8004_token_id": agent?.erc8004_token_id ?? null,
      "signa.bankr_token_address": agent?.bankr_token_address ?? null,
      "signa.extensions": ["x402", "erc-8004"],
      ...(agent?.x402_price_usdc != null && Number(agent.x402_price_usdc) > 0
        ? {
            "signa.x402": {
              price: Number(agent.x402_price_usdc),
              currency: agent.x402_currency ?? "USDC",
              chain: agent.x402_chain ?? "base",
              pay_to: agent.x402_pay_to ?? address,
            },
          }
        : {}),
    },
  });

  return NextResponse.json(card, {
    headers: {
      "cache-control": "public, max-age=60",
      "access-control-allow-origin": "*",
    },
  });
}
