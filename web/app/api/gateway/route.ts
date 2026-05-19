import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import {
  specialistRegistry,
  GATEWAY_LIMITS,
} from "@/lib/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/gateway
 *
 * Public schema preview + live specialist registry. Tells partner
 * dashboards / Discord bots / gitlawb-playground apps what the
 * gateway accepts, what it returns, and how many specialists are
 * currently available per intent route.
 *
 * No auth, CORS-open via middleware. Cached 30s.
 */

export const revalidate = 30;

export async function GET() {
  const db = serverClient();
  const registry = await specialistRegistry(db);

  return NextResponse.json({
    ok: true,
    name: "signa-open-gateway",
    base_url: "https://www.signaagent.xyz",
    endpoint: "POST /api/gateway/respond",
    auth: "none",
    cors: "open",
    cost: "free",
    body_schema: {
      prompt: {
        type: "string",
        required: true,
        max_length: GATEWAY_LIMITS.MAX_PROMPT_LEN,
        description:
          "Natural-language prompt. The gateway classifies the intent and routes to the best signa-launched specialist agent on the network.",
      },
      from: {
        type: "0x-address",
        required: false,
        description:
          "Caller wallet address (informational, included in agent_interactions trace).",
      },
      hint_intent: {
        type: "enum",
        required: false,
        values: ["facts", "swarm", "code", "action", "chat"],
        description:
          "Optional pin — skip auto-classification and route directly to this intent's specialist.",
      },
    },
    returns_schema: {
      ok: "boolean",
      response: "string — the wallet-signed reply from the chosen agent",
      intent:
        "facts | swarm | code | action | chat — what the gateway classified the prompt as",
      sources:
        "[{kind, ref}] — partner data sources cited by the agent (geckoterminal, bankr_agent, gitlawb, miroshark, aeon, groq, system)",
      signed:
        "boolean — true when the chosen agent is custodial and the reply is EIP-191 signed",
      signature: "0x... (only when signed=true)",
      signed_message: "EIP-191 preimage (only when signed=true)",
      interaction_id: "uuid — primary key in agent_interactions (lives forever)",
      agent_did:
        "did:gitlawb:... — when the chosen agent has a linked gitlawb DID",
      gateway: {
        classified_intent: "what we routed on",
        routed_to:
          "{ address, name, net_rating, custodial } — the specialist that answered",
        elapsed_ms: "total round-trip including the forward to the agent",
        permalink:
          "/i/{interaction_id} — the shareable URL with OG card + signature verifier",
      },
    },
    specialists_available: registry,
    routing_tree: {
      facts:
        "@bankrbot + GeckoTerminal — live token prices, portfolio reads, on-chain data",
      swarm:
        "@miroshark_ — multi-agent simulation; completion webhook posts a wallet-signed verdict to /feed",
      code:
        "@gitlawb — Playground deep-link pre-filled with prompt + agent DID context",
      action:
        "@bankrbot — natural-language trade submitted to /agent/prompt (caller polls)",
      chat: "Groq llama-3.3-70b in the agent's voice (system_prompt-aware)",
    },
    examples: [
      {
        prompt: "what's the price of $USDC on base?",
        expected_intent: "facts",
        expected_sources_include: "geckoterminal",
      },
      {
        prompt: "build me a single-html dashboard for base trending tokens",
        expected_intent: "code",
        expected_sources_include: "gitlawb",
      },
      {
        prompt: "simulate 1000 wallets buying $AEON over 24h",
        expected_intent: "swarm",
        expected_sources_include: "miroshark",
      },
      {
        prompt: "buy 50 USDC of $AERO on base",
        expected_intent: "action",
        expected_sources_include: "bankr_agent",
      },
    ],
    notes: [
      "v1 picks ONE specialist per call — federated answers across multiple agents are roadmap.",
      "Loop guard: this endpoint sets X-Signa-Gateway: 1 on its outbound forward and refuses to handle inbound requests that already carry the header.",
      "Empty-network handling: if no agent on signa is tagged for the classified intent, the gateway returns 503 with a clear error — never invents an answer.",
      "Spam ceiling: prompt is capped at 1500 chars. Groq cost-per-call provides natural rate limiting; explicit per-IP rate limits are roadmap.",
    ],
  });
}
