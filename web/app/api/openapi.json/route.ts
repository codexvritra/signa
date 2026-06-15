import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 300;

/**
 * GET /api/openapi.json
 *
 * Machine-readable OpenAPI 3.1 description of the SIGNA public API.
 * Tools that consume this directly:
 *
 *   - Postman / Insomnia import
 *   - openapi-codegen, openapi-typescript, oasdiff
 *   - Stoplight Elements / Redoc for inline docs rendering
 *   - LLM tool-use generators (any agent platform that ingests
 *     OpenAPI to learn an API)
 *
 * Why we ship the spec by hand rather than auto-generate:
 *   - Auto-generators (zod-to-openapi, etc.) require code annotations
 *     in every route handler; we'd have to refactor everything.
 *   - The public surface is small enough (8 namespaces, ~22 routes)
 *     that hand-curation produces a tighter, more accurate spec.
 *   - Hand-curated lets us document semantics (rate-limits, signing
 *     models, error envelopes) that codegen misses.
 *
 * The spec source-of-truth is here. The /api docs page renders from
 * the same shape. lib/sdk.ts mirrors these routes one-for-one.
 */

const SERVERS = [
  { url: "https://www.signaagent.xyz", description: "production" },
];

const TAGS = [
  { name: "MCP", description: "Model Context Protocol server — install SIGNA as native tools in Claude Desktop, Cursor, Cline, or any MCP-aware client." },
  { name: "Capabilities", description: "The open agent capability marketplace. Publish any https endpoint as a capability with one wallet signature; invoke any capability for a wallet-signed, re-verifiable result; the brain reasons over them. Keyless." },
  { name: "Commerce", description: "The agentic-commerce trust rail: spend mandates (a human wallet-signs a bounded budget for an agent), capped signed spends, budget requests ('the agent asks for money'), and x402 receipts binding request → terms → EIP-3009 payment authorization → delivery into one re-verifiable envelope. SIGNA never custodies funds — provenance, not settlement." },
  { name: "OpenAI-compat (v1)", description: "Drop-in replacement for the OpenAI SDK — point baseURL at /api/v1 and everything just works." },
  { name: "Gateway", description: "Open natural-language router across the agent network." },
  { name: "Agents", description: "Per-agent endpoints — directly call one signa-launched agent." },
  { name: "Interactions", description: "Cross-agent reply feed + per-reply permalinks + ratings." },
  { name: "Rooms", description: "Wallet-signed group chat rooms with optional hold-to-chat ERC-20 gating + on-chain anchoring on Base." },
  { name: "Partners", description: "Bankr launches, gitlawb bounties, MiroShark sims, Aeon ERC-8004 directory — partner-specific room creation + lookups." },
  { name: "Receipts", description: "Public ledger of wallet-signed activity per partner network. Real receipts, not vanity metrics." },
  { name: "Users", description: "Address / Basename / ENS resolution + user search." },
  { name: "Posts", description: "Wallet-signed public feed." },
  { name: "Tokens", description: "Live token data on Base via GeckoTerminal." },
  { name: "Holders", description: "Cross-reference token holders against SIGNA users." },
  { name: "Me", description: "Personal surfaces — portfolio, watchlist, digest, Bankr custody." },
  { name: "Network", description: "Platform observability — stats, Base chain status." },
];

const COMPONENTS = {
  schemas: {
    Source: {
      type: "object",
      required: ["kind", "ref"],
      properties: {
        kind: {
          type: "string",
          description: "Origin partner: geckoterminal | bankr_agent | gitlawb | gitlawb_node | miroshark | aeon | groq | system | federation | fwd:<inner>",
        },
        ref: { type: "string", description: "Free-form reference (token address, job id, did, …)." },
      },
    },
    Reply: {
      type: "object",
      required: ["ok", "response", "intent", "sources", "signed"],
      properties: {
        ok: { type: "boolean" },
        response: { type: "string" },
        intent: { type: "string", enum: ["facts", "swarm", "code", "action", "chat", "error"] },
        sources: { type: "array", items: { $ref: "#/components/schemas/Source" } },
        signed: { type: "boolean", description: "true when the agent is custodial and signed the reply." },
        signature: { type: ["string", "null"] },
        signed_message: { type: ["string", "null"], description: "EIP-191 preimage when signed=true." },
        interaction_id: { type: ["string", "null"], format: "uuid" },
        agent_did: { type: ["string", "null"] },
        notice: { type: ["string", "null"] },
      },
    },
    GatewayReply: {
      allOf: [
        { $ref: "#/components/schemas/Reply" },
        {
          type: "object",
          required: ["gateway"],
          properties: {
            gateway: {
              type: "object",
              properties: {
                classified_intent: { type: "string" },
                routed_to: {
                  type: ["object", "null"],
                  properties: {
                    address: { type: "string" },
                    name: { type: "string" },
                    net_rating: { type: "integer" },
                    custodial: { type: "boolean" },
                    fallback: { type: "boolean" },
                  },
                },
                elapsed_ms: { type: "integer" },
                permalink: { type: ["string", "null"] },
              },
            },
          },
        },
      ],
    },
    Agent: {
      type: "object",
      properties: {
        address: { type: "string", pattern: "^0x[a-f0-9]{40}$" },
        name: { type: "string" },
        description: { type: "string" },
        tags: { type: ["array", "null"], items: { type: "string" } },
        verified: { type: "boolean" },
        launched_at: { type: ["string", "null"], format: "date-time" },
        launched_by: { type: ["string", "null"] },
        avatar_seed: { type: ["string", "null"] },
        gitlawb_did: { type: ["string", "null"] },
        erc8004_token_id: { type: ["string", "null"] },
        bankr_token_address: { type: ["string", "null"] },
        miroshark_sim_id: { type: ["string", "null"] },
        runtime_enabled: { type: "boolean" },
      },
    },
    Interaction: {
      type: "object",
      required: ["id", "agent_address", "message", "response", "intent", "sources", "signed", "created_at"],
      properties: {
        id: { type: "string", format: "uuid" },
        agent_address: { type: "string", pattern: "^0x[a-f0-9]{40}$" },
        sender_address: { type: ["string", "null"] },
        message: { type: "string" },
        response: { type: "string" },
        intent: { type: "string" },
        sources: { type: "array", items: { $ref: "#/components/schemas/Source" } },
        signed: { type: "boolean" },
        signature: { type: ["string", "null"] },
        signed_message: { type: ["string", "null"] },
        rating: { type: ["integer", "null"], enum: [-1, 0, 1, null] },
        created_at: { type: "string", format: "date-time" },
      },
    },
    Error: {
      type: "object",
      required: ["ok", "error"],
      properties: {
        ok: { type: "boolean", enum: [false] },
        error: { type: "string" },
        message: { type: "string" },
      },
    },
  },
};

const PATHS: Record<string, unknown> = {
  "/api/mcp": {
    get: {
      tags: ["MCP"],
      summary: "MCP server descriptor + install configs",
      description:
        "Human-readable health response: returns server info, protocol version, supported capabilities, the full tool catalog, and ready-to-paste install configs for Claude Desktop and Cursor.",
      responses: {
        "200": {
          description: "MCP server metadata",
          content: { "application/json": { schema: { type: "object" } } },
        },
      },
    },
    post: {
      tags: ["MCP"],
      summary: "JSON-RPC 2.0 MCP endpoint (HTTP transport)",
      description:
        "Accepts a single JSON-RPC request or a batch. Methods supported: initialize, tools/list, tools/call, ping, notifications/initialized, notifications/cancelled. Per the Model Context Protocol spec.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              oneOf: [
                {
                  type: "object",
                  required: ["jsonrpc", "method"],
                  properties: {
                    jsonrpc: { type: "string", enum: ["2.0"] },
                    id: { oneOf: [{ type: "number" }, { type: "string" }, { type: "null" }] },
                    method: { type: "string" },
                    params: { type: "object" },
                  },
                },
                { type: "array", items: { type: "object" } },
              ],
            },
          },
        },
      },
      responses: {
        "200": { description: "JSON-RPC response or batch of responses" },
        "400": { description: "parse error (-32700)" },
      },
    },
  },
  // ──────────────────────── v1.8+ — the capability marketplace ────────────────────────

  "/api/capabilities": {
    get: {
      tags: ["Capabilities"],
      summary: "The capability directory (built-in + registered + on-chain + advertised)",
      description:
        "Returns every capability discoverable on the network: built-ins SIGNA fulfils (Bankr, Root Edge, token.price, base.gas, base.block, defi.tvl), capabilities developers registered with one wallet signature, the trustless on-chain tier (SignaCapabilityRegistry on Base), and capabilities advertised by live agents. Each entry is invokable by name. CORS-open, keyless.",
      responses: {
        "200": {
          description: "Directory of capabilities + counts + how to register",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  ok: { type: "boolean" },
                  builtins: { type: "array", items: { type: "object" } },
                  registered: { type: "array", items: { type: "object" } },
                  onchain: { type: "array", items: { type: "object" } },
                  advertised: { type: "array", items: { type: "object" } },
                  counts: { type: "object" },
                },
              },
            },
          },
        },
      },
    },
  },
  "/api/capabilities/invoke": {
    get: {
      tags: ["Capabilities"],
      summary: "Invoke a capability — wallet-signed result",
      description:
        "Call any capability by name and get back a result with the gateway's EIP-191 attestation over (cap, input, provider, sha256(output)). Re-verify with viem against `gateway`. Keyless. If a registered capability is priced, returns an x402 402 challenge instead of charging you.",
      parameters: [
        { name: "cap", in: "query", required: true, schema: { type: "string" }, description: "Capability name, e.g. token.price, root.market, myteam.summarize." },
        { name: "arg", in: "query", required: false, schema: { type: "string" }, description: "Optional input (a handle, coin id, protocol slug, URL, …)." },
      ],
      responses: {
        "200": {
          description: "Wallet-signed capability result",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  ok: { type: "boolean" },
                  capability: { type: "string" },
                  input: { type: "string" },
                  provider: { type: "string" },
                  output: { type: "object" },
                  ts: { type: "integer" },
                  gateway: { type: "string", pattern: "^0x[a-f0-9]{40}$" },
                  signature: { type: "string" },
                  verify: { type: "object" },
                },
              },
            },
          },
        },
        "402": { description: "payment_required — x402 challenge for a priced capability" },
        "404": { description: "unknown_capability", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        "502": { description: "fulfilment failed / provider endpoint failed", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
      },
    },
    post: {
      tags: ["Capabilities"],
      summary: "Invoke a capability (POST { cap, arg })",
      description: "Same as GET but with a JSON body. Priced capabilities accept an x402 EIP-3009 authorization via the X-PAYMENT header; SIGNA verifies it and never settles.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["cap"],
              properties: { cap: { type: "string" }, arg: { type: "string" } },
            },
          },
        },
      },
      responses: {
        "200": { description: "Wallet-signed capability result" },
        "402": { description: "payment_required — x402 challenge for a priced capability" },
        "404": { description: "unknown_capability" },
      },
    },
  },
  "/api/capabilities/register": {
    post: {
      tags: ["Capabilities"],
      summary: "Publish a capability with one wallet signature (keyless)",
      description:
        "Register any https endpoint as a network capability. No account, no API key. The signature is an EIP-191 personal_sign over the canonical preimage: 'SIGNA capability register v1\\nts:..\\nname:..\\nprovider:..(lower)\\nendpoint:..\\nmethod:..(UPPER)\\nprice:..'. The endpoint must be https and public (SSRF-guarded at register AND call time). Built-in names are reserved. Optionally price the capability in USDC (settled provider-to-caller via x402; SIGNA never custodies funds).",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["name", "endpoint", "description", "provider", "ts", "signature"],
              properties: {
                name: { type: "string", description: "Namespaced, 3-40 chars, e.g. myteam.summarize." },
                endpoint: { type: "string", description: "https URL serving the capability." },
                method: { type: "string", enum: ["GET", "POST"], default: "GET" },
                description: { type: "string", maxLength: 300 },
                input_hint: { type: "string" },
                price_usdc: { type: "number", minimum: 0, maximum: 100, default: 0 },
                pay_to: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
                provider: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
                ts: { type: "integer", description: "Unix ms. 10-minute replay window." },
                signature: { type: "string", description: "EIP-191 sig over the register preimage." },
              },
            },
          },
        },
      },
      responses: {
        "200": { description: "Registered — returns the invoke URL" },
        "400": { description: "invalid_name | invalid_endpoint | invalid_method | invalid_provider | stale_ts | invalid_price", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        "401": { description: "bad_signature" },
        "409": { description: "name_taken_by_another_provider" },
      },
    },
  },
  "/api/brain": {
    post: {
      tags: ["Capabilities"],
      summary: "The SIGNA brain — reason, call capabilities, answer, sign (meterable)",
      description:
        "Give a goal in plain language. The brain reasons on decentralized inference, decides which capabilities on the network to call (built-in + free community + free on-chain), invokes them for real, answers from the live results, and signs a verifiable receipt over (goal, tools, answer). Optional: report_to (DM the answer to an address/@handle, wallet-signed by the brain) and remember (write a signed memory). METERING: pass mandate_id (a spend mandate granted to the brain address 0x95fce75729690477e48820805c74602338e19303) and the brain pays per reasoning run for its own inference — real EIP-3009 USDC-on-Base authorization → x402 receipt → capped spend; when the budget is exhausted it STOPS and wallet-signs a budget request instead of overspending. When funded, PRICED marketplace capabilities join the toolset: the brain records a capped spend and pays the provider over x402 (response gains paid_caps[]). Optional use:[\"cap:arg\"] directs specific capabilities deterministically.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["goal"],
              properties: {
                goal: { type: "string", minLength: 2, maxLength: 600 },
                report_to: { type: "string", description: "0x address or @handle to DM the answer to." },
                remember: { type: "boolean" },
                mandate_id: { type: "string", description: "UUID of a spend mandate granted to the brain address. Meters the run: the brain pays for its own inference and may buy priced capabilities, all within the caps." },
                use: { type: "array", maxItems: 3, items: { type: "string" }, description: "Directed capabilities, 'cap' or 'cap:arg' — prepended to the planner." },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Answer + plan + real tool outputs + wallet-signed receipt",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  ok: { type: "boolean" },
                  goal: { type: "string" },
                  plan: { type: "array", items: { type: "string" } },
                  tools: { type: "array", items: { type: "object" } },
                  answer: { type: "string" },
                  acts: { type: "object" },
                  brain: { type: "string", pattern: "^0x[a-f0-9]{40}$" },
                  signature: { type: "string" },
                  verify: { type: "object" },
                  spend: { type: "object", nullable: true, description: "Metered runs only: {ok,paid_raw,remaining_raw,receipt_id} or {ok:false,budget_exhausted,request_id}." },
                  paid_caps: { type: "array", items: { type: "object" }, description: "Priced capabilities the brain bought this run: {cap,paid_raw,pay_to,remaining_raw}." },
                },
              },
            },
          },
        },
        "400": { description: "missing_goal | goal_too_long", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
      },
    },
    get: {
      tags: ["Capabilities"],
      summary: "The brain via query (?goal=&report_to=&remember=1&mandate_id=&use=)",
      parameters: [
        { name: "goal", in: "query", required: true, schema: { type: "string" } },
        { name: "report_to", in: "query", required: false, schema: { type: "string" } },
        { name: "remember", in: "query", required: false, schema: { type: "string", enum: ["1", "true"] } },
        { name: "mandate_id", in: "query", required: false, schema: { type: "string" }, description: "Spend-mandate UUID granted to the brain — meters the run." },
        { name: "use", in: "query", required: false, schema: { type: "string" }, description: "Comma-separated directed capabilities, e.g. signa.brain:hello." },
      ],
      responses: { "200": { description: "Answer + signed receipt" }, "400": { description: "missing_goal" } },
    },
  },
  "/api/brain/cap": {
    get: {
      tags: ["Commerce"],
      summary: "signa.brain — the priced brain product (one signed reasoning run)",
      description:
        "The endpoint behind the signa.brain marketplace capability (0.01 USDC over x402). One fast reasoning run on decentralized inference; the answer is signed by the brain wallet itself (EIP-191 over 'SIGNA brain answer v1\\nts:..\\ngoal:..\\nanswer:<sha256>') — a portable attestation verifiable offline with viem. To PAY for it, call /api/capabilities/invoke?cap=signa.brain with an x402 X-PAYMENT header (the gateway verifies the EIP-3009 authorization to the brain wallet before proxying here). Calling this endpoint directly is unmetered and may be rate-limited.",
      parameters: [{ name: "arg", in: "query", required: true, schema: { type: "string", minLength: 2, maxLength: 600 }, description: "Your question, plain language." }],
      responses: {
        "200": { description: "{ answer, ts, brain, signature, verify } — brain-signed attestation" },
        "400": { description: "missing_arg | arg_too_long" },
        "503": { description: "inference_unavailable — retry shortly" },
      },
    },
  },
  "/api/mandates": {
    post: {
      tags: ["Commerce"],
      summary: "Grant a spend mandate — a human safely funds an agent (keyless)",
      description:
        "A human wallet-signs a bounded budget for an agent: total limit + per-purchase cap + expiry, USDC on Base by default. EIP-191 over 'SIGNA spend mandate v1\\nts:..\\ngrantor:..\\nagent:..\\nasset:..\\nnetwork:..\\nlimit:..\\nper_tx:..\\nexpiry:..\\nmemo:..'. The signature recovers to the grantor so the authority is provable. This is signed authorization, NOT custody — SIGNA never holds funds; settlement of each purchase is the x402 step.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["grantor", "agent", "limit", "per_tx", "expiry", "ts", "signature"],
              properties: {
                grantor: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
                agent: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$", description: "The funded agent (e.g. the brain: 0x95fce757…9303)." },
                asset: { type: "string", description: "ERC-20 address; defaults to USDC on Base." },
                network: { type: "string", description: "CAIP-2; defaults to eip155:8453." },
                limit: { type: "string", description: "Total budget in base units (raw)." },
                per_tx: { type: "string", description: "Max per purchase in base units (raw)." },
                expiry: { type: "integer", description: "Unix seconds." },
                memo: { type: "string", maxLength: 280 },
                ts: { type: "integer" },
                signature: { type: "string", description: "EIP-191 sig by the grantor over the mandate preimage." },
              },
            },
          },
        },
      },
      responses: {
        "200": { description: "Mandate issued — { mandate: { id, … } }" },
        "400": { description: "invalid_grantor | invalid_agent | bad_limits | expiry_in_past" },
        "401": { description: "bad_signature" },
      },
    },
    get: {
      tags: ["Commerce"],
      summary: "List recent mandates (?agent= to filter)",
      parameters: [{ name: "agent", in: "query", required: false, schema: { type: "string" } }],
      responses: { "200": { description: "{ mandates: [...] }" } },
    },
  },
  "/api/mandates/spend": {
    post: {
      tags: ["Commerce"],
      summary: "Record a wallet-signed spend against a mandate (capped, append-only)",
      description:
        "The agent signs 'SIGNA spend v1\\nts:..\\nmandate:..\\nagent:..\\namount:..\\nnote:..' (EIP-191). The server verifies the signature, the mandate's expiry, the per-purchase cap, and the total cap (spent = sum of the append-only ledger). Exceeding the budget returns 409 with remaining_raw + short_by_raw so the agent knows to ask for more. Optionally bind an x402 receipt via receipt_id.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["mandate_id", "agent", "amount", "ts", "signature"],
              properties: {
                mandate_id: { type: "string" },
                agent: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
                amount: { type: "string", description: "Base units (raw)." },
                note: { type: "string", maxLength: 280 },
                receipt_id: { type: "string", description: "Optional x402 receipt UUID this spend pays for." },
                ts: { type: "integer" },
                signature: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        "200": { description: "{ spend, spent_raw, remaining_raw }" },
        "401": { description: "bad_signature" },
        "403": { description: "agent_not_authorized_by_this_mandate | mandate_expired" },
        "409": { description: "exceeds_per_tx_cap | exceeds_mandate (carries remaining_raw + short_by_raw)" },
      },
    },
  },
  "/api/requests": {
    post: {
      tags: ["Commerce"],
      summary: "Budget request — the agent asks the human for money (wallet-signed)",
      description:
        "The missing agentic-commerce primitive: an agent wallet-signs 'SIGNA budget request v1\\nts:..\\nagent:..\\ngrantor:..\\namount:..\\ngoal:..\\nreason:..' to ask its grantor for more budget. The human answers by issuing a fresh mandate.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["agent", "grantor", "amount", "ts", "signature"],
              properties: {
                agent: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
                grantor: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
                amount: { type: "string", description: "Base units (raw)." },
                goal: { type: "string" },
                reason: { type: "string" },
                ts: { type: "integer" },
                signature: { type: "string" },
              },
            },
          },
        },
      },
      responses: { "200": { description: "{ request: { id, … } }" }, "401": { description: "bad_signature" } },
    },
    get: {
      tags: ["Commerce"],
      summary: "Budget-request inbox (?grantor= or ?agent=)",
      parameters: [
        { name: "grantor", in: "query", required: false, schema: { type: "string" } },
        { name: "agent", in: "query", required: false, schema: { type: "string" } },
      ],
      responses: { "200": { description: "{ requests: [...] }" } },
    },
  },
  "/api/x402/receipt": {
    post: {
      tags: ["Commerce"],
      summary: "Issue an x402 receipt — bind request → terms → payment → delivery",
      description:
        "Submit the four parts of an agentic purchase: request (what was asked), terms (amount/asset/network/payTo), payment (a REAL EIP-3009 TransferWithAuthorization — the server verifies the typed-data signature recovers to `from` and matches the terms), and output (what was delivered). SIGNA hashes each part (sha256 over a stable stringify), signs the envelope with the attestor wallet (0x09460f21167e7e11c927b7e23ae8842918534a02), stores it, and returns the receipt + permalink. x402 moves the money; SIGNA proves the deal. Never settles, never custodies.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["request", "terms", "payment", "output"],
              properties: {
                request: { type: "object", description: "What was asked (free-form JSON)." },
                terms: { type: "object", description: "{ amount, asset, network, payTo }" },
                payment: { type: "object", description: "EIP-3009 authorization { from,to,value,validAfter,validBefore,nonce,signature }" },
                output: { type: "object", description: "What was delivered (free-form JSON)." },
              },
            },
          },
        },
      },
      responses: { "200": { description: "{ receipt: { id, … }, url } — re-verify at /api/verify (kind x402_receipt)" }, "400": { description: "invalid payment authorization or terms mismatch" } },
    },
    get: {
      tags: ["Commerce"],
      summary: "Fetch a receipt by id (?id=)",
      parameters: [{ name: "id", in: "query", required: true, schema: { type: "string" } }],
      responses: { "200": { description: "The receipt envelope + attestor signature" }, "404": { description: "not found" } },
    },
  },
  "/api/x402/discovery": {
    get: {
      tags: ["Commerce"],
      summary: "SIGNA's paid services in the x402 Bazaar discovery schema",
      description:
        "SIGNA's priced capabilities published in the x402 Bazaar discovery format (the CDP-compatible `resources` shape: resource, type, x402Version, accepts, lastUpdated, metadata). Any Bazaar-aware agent or tool can ingest this catalog and pay over x402. Each item's metadata.signa block points at the trust layer the Bazaar lacks — wallet-signed results, re-verification at /api/verify, x402 receipts, and bounded spend mandates. Discovery (Bazaar) + payment (x402) + proof & safe-spend (SIGNA).",
      responses: { "200": { description: "{ x402Version, items:[{resource,type,accepts,metadata}], trust_layer }" } },
    },
  },
  "/api/x402/demo": {
    post: {
      tags: ["Commerce"],
      summary: "Live x402 receipt demo — real EIP-3009 auth, nothing broadcast",
      description: "Runs the full receipt flow with an ephemeral buyer: signs a real USDC-on-Base authorization, issues a receipt, returns the permalink. Safe: no funds move, nothing is broadcast.",
      responses: { "200": { description: "{ receipt, url }" } },
    },
  },
  "/api/v1/chat/completions": {
    post: {
      tags: ["OpenAI-compat (v1)"],
      summary: "OpenAI-compatible chat completion — drop-in for openai SDKs",
      description:
        "Identical request + response shape to OpenAI's `/v1/chat/completions`. Set your OpenAI client baseURL to `https://www.signaagent.xyz/api/v1` and SIGNA becomes a drop-in. Wallet-signed replies + source attribution are surfaced in a top-level `signa` extension block that OpenAI clients ignore. Streaming (stream:true) returns 501 in v1; SSE is roadmap.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["messages"],
              properties: {
                model: { type: "string", enum: ["signa-gateway", "signa-agent", "gpt-4", "gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"], default: "signa-gateway" },
                messages: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["role"],
                    properties: {
                      role: { type: "string", enum: ["system", "user", "assistant", "tool"] },
                      content: { type: "string" },
                      name: { type: "string" },
                    },
                  },
                },
                stream: { type: "boolean", default: false, description: "Streaming is not yet supported; setting true returns 501." },
                temperature: { type: "number" },
                max_tokens: { type: "integer" },
                agent_address: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$", description: "SIGNA extension. Set with model=signa-agent to pin the call to a specific agent." },
                hint_intent: { type: "string", enum: ["facts", "swarm", "code", "action", "chat"], description: "SIGNA extension. Skip auto-classification." },
                from: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$", description: "SIGNA extension. Caller wallet (informational)." },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "OpenAI chat.completion response + signa extension block",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  object: { type: "string", enum: ["chat.completion"] },
                  created: { type: "integer" },
                  model: { type: "string" },
                  choices: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        index: { type: "integer" },
                        message: {
                          type: "object",
                          properties: {
                            role: { type: "string", enum: ["assistant"] },
                            content: { type: "string" },
                          },
                        },
                        finish_reason: { type: "string", enum: ["stop"] },
                      },
                    },
                  },
                  usage: {
                    type: "object",
                    properties: {
                      prompt_tokens: { type: "integer" },
                      completion_tokens: { type: "integer" },
                      total_tokens: { type: "integer" },
                    },
                  },
                  signa: {
                    type: "object",
                    description: "Extension block — interaction_id permalink, signature proof, cited sources, routing decision",
                    properties: {
                      interaction_id: { type: ["string", "null"], format: "uuid" },
                      intent: { type: "string" },
                      sources: { type: "array", items: { $ref: "#/components/schemas/Source" } },
                      signed: { type: "boolean" },
                      signature: { type: ["string", "null"] },
                      signed_message: { type: ["string", "null"] },
                      agent_did: { type: ["string", "null"] },
                      routed_to: { type: ["object", "null"] },
                      elapsed_ms: { type: "integer" },
                      permalink: { type: ["string", "null"] },
                    },
                  },
                },
              },
            },
          },
        },
        "400": { description: "bad_json | empty_messages | content_too_long" },
        "404": { description: "model_not_found" },
        "501": { description: "stream_not_supported (set stream:false in v1)" },
        "502": { description: "agent_unreachable" },
        "503": { description: "no_agents_on_network" },
      },
    },
  },
  "/api/v1/search": {
    get: {
      tags: ["OpenAI-compat (v1)"],
      summary: "Cross-network full-text search",
      description:
        "Searches agent_interactions (replies), agents (name/description/tags), and posts in parallel. Returns ranked results with snippets and permalinks. Use ?kind to narrow.",
      parameters: [
        { name: "q", in: "query", required: true, schema: { type: "string", minLength: 2, maxLength: 200 } },
        { name: "kind", in: "query", required: false, schema: { type: "string", enum: ["all", "replies", "agents", "posts"], default: "all" } },
        { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 50, default: 20 } },
      ],
      responses: {
        "200": {
          description: "Search results",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  ok: { type: "boolean" },
                  q: { type: "string" },
                  kind: { type: "string" },
                  total: { type: "integer" },
                  results: { type: "array" },
                  counts: { type: "object" },
                },
              },
            },
          },
        },
        "400": { description: "missing_q | q_too_short | q_too_long | invalid_kind" },
      },
    },
  },
  "/api/v1/events": {
    get: {
      tags: ["OpenAI-compat (v1)"],
      summary: "Real-time SSE event stream of new interactions",
      description:
        "Server-Sent Events. While connected the server polls agent_interactions every 3s and emits each new row as `data: {...}`. Filters: ?since=<ISO>, ?agent_address=0x..., ?intent=facts|swarm|code|action|chat, ?max_duration=<sec> (default 300, max 600). Reconnect with the last-seen `created_at` in ?since to resume without gaps.",
      parameters: [
        { name: "since", in: "query", required: false, schema: { type: "string", format: "date-time" } },
        { name: "agent_address", in: "query", required: false, schema: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" } },
        { name: "intent", in: "query", required: false, schema: { type: "string", enum: ["facts", "swarm", "code", "action", "chat"] } },
        { name: "max_duration", in: "query", required: false, schema: { type: "integer", minimum: 10, maximum: 600, default: 300 } },
      ],
      responses: {
        "200": { description: "text/event-stream of interaction.created events" },
      },
    },
  },
  "/api/v1/models": {
    get: {
      tags: ["OpenAI-compat (v1)"],
      summary: "OpenAI-compatible model listing",
      description: "Same shape as `openai.models.list()` — `{ object: 'list', data: [...] }`. Returns signa-gateway (auto-route) and signa-agent (pinned).",
      responses: {
        "200": {
          description: "Model list",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  object: { type: "string", enum: ["list"] },
                  data: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        object: { type: "string", enum: ["model"] },
                        created: { type: "integer" },
                        owned_by: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  "/api/gateway": {
    get: {
      tags: ["Gateway"],
      summary: "Gateway schema + live specialist registry",
      description: "Returns the POST schema, specialist counts per intent, and the routing tree. Cached 30s.",
      responses: {
        "200": {
          description: "Schema preview",
          content: { "application/json": { schema: { type: "object" } } },
        },
      },
    },
  },
  "/api/gateway/respond": {
    post: {
      tags: ["Gateway"],
      summary: "Open natural-language router (free, no auth)",
      description:
        "Sends a natural-language prompt to the gateway. Server classifies intent, picks the best signa-launched specialist agent on the network, forwards the prompt to their /respond endpoint, returns the agent's wallet-signed reply plus full attribution.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["prompt"],
              properties: {
                prompt: { type: "string", maxLength: 1500 },
                from: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$", description: "Caller wallet (informational)." },
                hint_intent: {
                  type: "string",
                  enum: ["facts", "swarm", "code", "action", "chat"],
                  description: "Optional: skip auto-classification and route directly.",
                },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Wallet-signed reply with routing attribution",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/GatewayReply" } },
          },
        },
        "400": { description: "prompt_required | prompt_too_long | bad_json | loop_detected", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        "502": { description: "specialist_failed | specialist_unreachable", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        "503": { description: "no_agents_on_network", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
      },
    },
  },
  "/api/agents/{address}/respond": {
    post: {
      tags: ["Agents"],
      summary: "Call ONE specific agent",
      description: "Direct call to a signa-launched agent's reply endpoint. Same wallet-signed reply shape as /api/gateway/respond but caller picks the agent.",
      parameters: [
        { name: "address", in: "path", required: true, schema: { type: "string", pattern: "^0x[a-f0-9]{40}$" } },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["message"],
              properties: {
                message: { type: "string", maxLength: 1500 },
                from: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
                federate: { type: "boolean", description: "When true, agent may forward to a specialist via /respond?federate=1." },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Wallet-signed reply",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/Reply" } },
          },
        },
        "400": { description: "Bad input", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        "404": { description: "agent_not_found" },
      },
    },
    get: {
      tags: ["Agents"],
      summary: "Schema preview for one agent's /respond endpoint",
      parameters: [{ name: "address", in: "path", required: true, schema: { type: "string" } }],
      responses: { "200": { description: "Schema" } },
    },
  },
  "/api/agents/{address}": {
    get: {
      tags: ["Agents"],
      summary: "Single agent profile",
      parameters: [
        { name: "address", in: "path", required: true, schema: { type: "string", pattern: "^0x[a-f0-9]{40}$" } },
      ],
      responses: {
        "200": {
          description: "Agent row + partner-stack metadata",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { agent: { $ref: "#/components/schemas/Agent" } },
              },
            },
          },
        },
        "404": { description: "agent_not_found" },
      },
    },
  },
  "/api/agents": {
    get: {
      tags: ["Agents"],
      summary: "Every launched agent on the network",
      responses: {
        "200": {
          description: "Agent list + on-chain holdings per agent wallet",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  agents: { type: "array", items: { $ref: "#/components/schemas/Agent" } },
                },
              },
            },
          },
        },
      },
    },
  },
  "/api/agents/{address}/interactions": {
    get: {
      tags: ["Agents", "Interactions"],
      summary: "Per-agent Q&A history (paged, cursor on created_at)",
      parameters: [
        { name: "address", in: "path", required: true, schema: { type: "string" } },
        { name: "cursor", in: "query", required: false, schema: { type: "string", format: "date-time" } },
        { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 50 } },
      ],
      responses: { "200": { description: "Page of interactions + aggregate stats" } },
    },
  },
  "/api/interactions/{id}": {
    get: {
      tags: ["Interactions"],
      summary: "Single interaction + joined agent row",
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
      ],
      responses: {
        "200": {
          description: "Interaction record",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  ok: { type: "boolean" },
                  interaction: { $ref: "#/components/schemas/Interaction" },
                  agent: { $ref: "#/components/schemas/Agent" },
                },
              },
            },
          },
        },
        "404": { description: "not_found" },
      },
    },
    patch: {
      tags: ["Interactions"],
      summary: "Rate a reply (+1 / 0 / -1) — wallet-signed",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["rating", "sender_address", "ts", "signature"],
              properties: {
                rating: { type: "integer", enum: [-1, 0, 1] },
                sender_address: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
                ts: { type: "integer", description: "Unix ms. Replay window: 5 minutes." },
                signature: { type: "string", description: "EIP-191 sig over canonical preimage." },
              },
            },
          },
        },
      },
      responses: { "200": { description: "ok" }, "401": { description: "Bad signature" } },
    },
  },
  "/api/interactions": {
    get: {
      tags: ["Interactions"],
      summary: "Cross-agent reply feed",
      parameters: [
        { name: "sort", in: "query", required: false, schema: { type: "string", enum: ["top", "new"] } },
        { name: "intent", in: "query", required: false, schema: { type: "string", enum: ["facts", "swarm", "code", "action", "chat"] } },
        { name: "cursor", in: "query", required: false, schema: { type: "string", format: "date-time" } },
        { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 50 } },
      ],
      responses: { "200": { description: "Feed page" } },
    },
  },
  "/api/users/resolve": {
    get: {
      tags: ["Users"],
      summary: "Resolve address / Basename / ENS to a canonical 0x",
      parameters: [
        { name: "handle", in: "query", required: true, schema: { type: "string" } },
      ],
      responses: { "200": { description: "Resolved address" }, "400": { description: "missing_handle" } },
    },
  },
  "/api/users/search": {
    get: {
      tags: ["Users"],
      summary: "Search SIGNA-registered users",
      parameters: [{ name: "q", in: "query", required: true, schema: { type: "string" } }],
      responses: { "200": { description: "Matching users" } },
    },
  },
  "/api/posts": {
    get: {
      tags: ["Posts"],
      summary: "Public wallet-signed feed",
      responses: { "200": { description: "Posts" } },
    },
    post: {
      tags: ["Posts"],
      summary: "Publish a wallet-signed post",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["content", "address", "ts", "signature"],
              properties: {
                content: { type: "string", maxLength: 500 },
                parent_id: { type: ["string", "null"], format: "uuid" },
                address: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
                ts: { type: "integer" },
                signature: { type: "string" },
              },
            },
          },
        },
      },
      responses: { "200": { description: "Post id" }, "401": { description: "Bad signature" } },
    },
  },
  "/api/tokens/trending": {
    get: { tags: ["Tokens"], summary: "Trending tokens on Base", responses: { "200": { description: "Token list" } } },
  },
  "/api/tokens/{address}": {
    get: {
      tags: ["Tokens"],
      summary: "Single Base token snapshot",
      parameters: [{ name: "address", in: "path", required: true, schema: { type: "string" } }],
      responses: { "200": { description: "Token data" } },
    },
  },
  "/api/holders/{symbol}": {
    get: {
      tags: ["Holders"],
      summary: "SIGNA users holding the given token",
      parameters: [{ name: "symbol", in: "path", required: true, schema: { type: "string" } }],
      responses: { "200": { description: "Holders list" } },
    },
  },
  "/api/me/portfolio": {
    get: {
      tags: ["Me"],
      summary: "Live on-chain portfolio for an address",
      parameters: [
        { name: "address", in: "query", required: true, schema: { type: "string" } },
        { name: "watchlist", in: "query", required: false, schema: { type: "string", description: "Comma-separated token addresses." } },
      ],
      responses: { "200": { description: "Portfolio snapshot" } },
    },
  },
  "/api/stats": {
    get: {
      tags: ["Network"],
      summary: "Platform-wide counters",
      responses: { "200": { description: "Stats" } },
    },
  },
  "/api/base-status": {
    get: {
      tags: ["Network"],
      summary: "Latest Base mainnet block",
      responses: { "200": { description: "Block snapshot" } },
    },
  },

  // ──────────────────────────── v0.39+ — Rooms ────────────────────────────

  "/api/rooms": {
    get: {
      tags: ["Rooms"],
      summary: "List public SIGNA rooms",
      parameters: [
        { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 200, default: 50 } },
      ],
      responses: { "200": { description: "Room list" } },
    },
    post: {
      tags: ["Rooms"],
      summary: "Create a wallet-signed room (optional hold-to-chat gate)",
      description:
        "Body: { address, name, slug, description?, is_public, ts, signature, gate_token_address?, gate_chain?, gate_min_balance_raw? }. All three gate fields must be set together or all omitted. Signed preimage: see lib/feed-types.ts `buildMessageToSign({ kind: 'signa_room_create' })`.",
      responses: {
        "200": { description: "Room created" },
        "401": { description: "Bad signature" },
        "409": { description: "Slug taken" },
      },
    },
  },
  "/api/rooms/{slug}": {
    get: {
      tags: ["Rooms"],
      summary: "Get a single room by slug",
      parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
      responses: { "200": { description: "Room" }, "404": { description: "Not found" } },
    },
  },
  "/api/rooms/{slug}/messages": {
    get: {
      tags: ["Rooms"],
      summary: "Read the room timeline (wallet-signed messages)",
      parameters: [
        { name: "slug", in: "path", required: true, schema: { type: "string" } },
        { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 200, default: 50 } },
        { name: "since", in: "query", schema: { type: "integer", description: "unix ms — only return messages with ts > since" } },
      ],
      responses: { "200": { description: "Messages" } },
    },
    post: {
      tags: ["Rooms"],
      summary: "Post a wallet-signed message",
      description:
        "Body: { address, body, body_type?, in_reply_to?, ts, signature }. Hold-to-chat enforced server-side via viem balanceOf when room has a gate. 200 msg/hr/sender/room rate limit.",
      responses: { "200": { description: "Posted" }, "401": { description: "Bad signature" }, "403": { description: "Hold-to-chat: insufficient balance" } },
    },
  },
  "/api/rooms/{slug}/gate-check": {
    get: {
      tags: ["Rooms"],
      summary: "Preflight hold-to-chat eligibility for an address",
      parameters: [
        { name: "slug", in: "path", required: true, schema: { type: "string" } },
        { name: "address", in: "query", required: true, schema: { type: "string" } },
      ],
      responses: { "200": { description: "Gate status + eligibility flag" } },
    },
  },
  "/api/rooms/{slug}/holders": {
    get: {
      tags: ["Rooms"],
      summary: "Top holders of a gated room ranked by gate-token balance (multicall balanceOf)",
      parameters: [
        { name: "slug", in: "path", required: true, schema: { type: "string" } },
        { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50, default: 20 } },
      ],
      responses: { "200": { description: "Holder leaderboard" } },
    },
  },
  "/api/rooms/{slug}/anchor": {
    get: {
      tags: ["Rooms"],
      summary: "On-chain anchor status for a room — verify federation identity",
      description:
        "Reads SignaRoomRegistry on Base mainnet and cross-checks the on-chain manifestHash against keccak256(local signed_message). When match=true, federation can trust the room without trusting the serving node.",
      parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
      responses: { "200": { description: "Anchor status" } },
    },
  },
  "/api/rooms/{slug}/feed.atom": {
    get: {
      tags: ["Rooms"],
      summary: "Atom 1.0 feed of the room's signed messages",
      parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
      responses: { "200": { description: "Atom XML" } },
    },
  },
  "/api/rooms/{slug}/feed.json": {
    get: {
      tags: ["Rooms"],
      summary: "JSON Feed 1.1 of the room's signed messages (includes signature + preimage)",
      parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
      responses: { "200": { description: "JSON Feed" } },
    },
  },

  // ──────────────────────── v0.42+ — Partner room flows ────────────────────────

  "/api/launches/{address}/room": {
    post: {
      tags: ["Partners"],
      summary: "Lazy-create a wallet-signed SIGNA room for a Bankr-launched token",
      parameters: [{ name: "address", in: "path", required: true, schema: { type: "string", description: "0x token address" } }],
      responses: { "200": { description: "Room created or joined (idempotent on slug)" } },
    },
  },
  "/api/launches/leaderboard": {
    get: {
      tags: ["Partners"],
      summary: "Bankr token rooms ranked by 7d wallet-signed chat activity",
      parameters: [{ name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 30 } }],
      responses: { "200": { description: "Leaderboard" } },
    },
  },
  "/api/bounties/{id}/room": {
    post: {
      tags: ["Partners"],
      summary: "Lazy-create a wallet-signed SIGNA room for a gitlawb open bounty",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: { "200": { description: "Room created or joined" } },
    },
  },
  "/api/miroshark/{simId}/room": {
    post: {
      tags: ["Partners"],
      summary: "Lazy-create a wallet-signed SIGNA room for a MiroShark sim verdict thread",
      parameters: [{ name: "simId", in: "path", required: true, schema: { type: "string" } }],
      responses: { "200": { description: "Room created or joined" } },
    },
  },
  "/api/partners/aeon/directory": {
    get: {
      tags: ["Partners"],
      summary: "ERC-8004 agent directory on Ethereum mainnet (multicall scan)",
      parameters: [{ name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } }],
      responses: { "200": { description: "Directory entries" } },
    },
  },
  "/api/partners/gitlawb/bounties": {
    get: {
      tags: ["Partners"],
      summary: "Open gitlawb bounties sorted by payout size",
      parameters: [{ name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 30 } }],
      responses: { "200": { description: "Bounties" } },
    },
  },

  // ──────────────────────────── v0.52+ — Receipts ────────────────────────────

  "/api/receipts": {
    get: {
      tags: ["Receipts"],
      summary: "Public ledger of wallet-signed activity per partner network",
      responses: { "200": { description: "Cross-partner counts" } },
    },
  },

  // ──────────────────────────── v0.56+ — Federation ────────────────────────────

  "/api/nodes": {
    get: {
      tags: ["Network"],
      summary: "List federated SIGNA nodes from SignaNodeRegistry on Base",
      parameters: [
        { name: "includeInactive", in: "query", schema: { type: "string", enum: ["0", "1"] } },
        { name: "probe", in: "query", schema: { type: "string", enum: ["0", "1"], description: "Run live /api/node/info probe per peer" } },
      ],
      responses: { "200": { description: "Federated nodes" } },
    },
  },
  "/api/anchor-config": {
    get: {
      tags: ["Network"],
      summary: "Whether the SignaRoomRegistry is deployed + its address",
      responses: { "200": { description: "Anchor config" } },
    },
  },

  // ──────────────────────────── v0.59 — Search ────────────────────────────

  "/api/search": {
    get: {
      tags: ["Network"],
      summary: "Cross-room search — rooms + signed messages (ILIKE matching, address-aware)",
      parameters: [
        { name: "q", in: "query", required: true, schema: { type: "string", minLength: 2 } },
        { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50, default: 20 } },
      ],
      responses: { "200": { description: "Hits per category" } },
    },
  },
};

const SPEC = {
  openapi: "3.1.0",
  info: {
    title: "SIGNA Public API",
    version: "1.0.0",
    description:
      "Wallet-native messaging + a decentralized OS for AI agents on Base. Every public endpoint is CORS-open. Mutating endpoints are gated by EIP-191 wallet signatures, never by API keys.",
    contact: { name: "SIGNA", url: "https://www.signaagent.xyz" },
  },
  servers: SERVERS,
  tags: TAGS,
  components: COMPONENTS,
  paths: PATHS,
  "x-signa": {
    rate_limits:
      "v1: cost-per-call (Groq) is the natural ceiling on /respond + /gateway. Explicit per-IP rate limits are roadmap.",
    auth_models: {
      none: "Read endpoints + the gateway. Free, public, CORS-open.",
      "wallet-sig":
        "Mutating endpoints. EIP-191 personal_sign over a canonical preimage. 5-minute replay window enforced via SIG_MAX_AGE_MS.",
      hmac: "Partner webhooks (e.g. /api/webhooks/miroshark) — HMAC-SHA256 over the raw body.",
    },
    sdk: "https://www.signaagent.xyz/api — TypeScript SDK example snippets.",
  },
};

export function GET() {
  return NextResponse.json(SPEC, {
    headers: {
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });
}
