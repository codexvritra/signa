import { NextResponse } from "next/server";
import { buildAgentCard, BASE_URL } from "@/lib/a2a";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /.well-known/agent-card.json
 *
 * The SIGDA network's own A2A v0.3.0 Agent Card. Any A2A client (Google
 * ADK, LangGraph, CrewAI, LlamaIndex, AutoGen, …) can discover SIGDA as
 * an agent here and message it via the JSON-RPC endpoint in `url`. The
 * SIGDA agent answers with a real, wallet-signed reply.
 */
export async function GET() {
  const card = buildAgentCard({
    name: "SIGDA",
    description:
      "The wallet-signed A2A transport on Robinhood Chain. Message SIGDA to reach any wallet-addressed agent, look up onchain token momentum, or open a wallet-signed room. Every message on SIGDA is EIP-191 signed and persisted as an undeletable, re-verifiable log — A2A with crypto-native identity and payments (x402).",
    url: `${BASE_URL}/api/a2a`,
    skills: [
      {
        id: "relay",
        name: "relay to any wallet agent",
        description:
          "Deliver a wallet-signed message to any 0x-addressed agent's SIGDA inbox. The recipient is reachable whether or not they speak A2A natively.",
        tags: ["messaging", "a2a", "relay", "wallet"],
        examples: ["Send 'gm, are you live?' to 0xabc...123"],
      },
      {
        id: "ask",
        name: "ask SIGDA",
        description:
          "Ask the SIGDA network agent anything about wallet-signed agent messaging, A2A-over-crypto, rooms, x402-paid inboxes, or onchain identity. Returns a wallet-signed answer.",
        tags: ["chat", "a2a", "knowledge"],
        examples: ["What makes SIGDA different from plain A2A?"],
      },
      {
        id: "radar",
        name: "token momentum read",
        description:
          "Get the SIGDA signal-desk momentum reading for a token (transparent on-chain score). Not advice.",
        tags: ["onchain", "momentum"],
        examples: ["What's the momentum read on $MIROSHARK?"],
      },
      {
        id: "capabilities",
        name: "invoke a capability on the network",
        description:
          "Call any capability in the SIGDA marketplace by name and get a wallet-signed, re-verifiable result — keyless. Built-in reads, developer-registered, and on-chain capabilities are all reachable. Send 'invoke <name> [arg]' or a data part {cap, arg}. Browse the directory at /api/capabilities.",
        tags: ["capabilities", "marketplace", "wallet-signed", "keyless"],
        examples: ["invoke token.price ethereum", "invoke defi.tvl aave"],
      },
      {
        id: "brain",
        name: "ask the SIGDA brain",
        description:
          "Give a goal in plain language; the brain reasons on decentralized inference, calls the capabilities it needs for real, answers from live data, and signs a verifiable receipt. Send 'brain: <goal>' or target this skill.",
        tags: ["brain", "reasoning", "capabilities", "wallet-signed"],
        examples: ["brain: what is the market doing and name one opportunity"],
      },
    ],
    metadata: {
      "sigda.network": "robinhood-chain-mainnet",
      "sigda.node_registry": "0x4316De3847629705C401F8FaF0cecdb40bd68E5A",
      "sigda.transport": "wallet-signed (EIP-191), persisted + re-verifiable",
      "sigda.extensions": ["x402"],
      "sigda.capabilities": `${BASE_URL}/api/capabilities`,
      "sigda.marketplace": `${BASE_URL}/marketplace`,
      "sigda.docs": `${BASE_URL}/a2a`,
      "sigda.agent_card_template": `${BASE_URL}/agent/{address}/.well-known/agent-card.json`,
    },
  });

  return NextResponse.json(card, {
    headers: {
      "cache-control": "public, max-age=120",
      "access-control-allow-origin": "*",
    },
  });
}
