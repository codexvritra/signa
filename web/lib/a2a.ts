/**
 * v0.87 — A2A (Agent2Agent) v0.3.0 transport for SIGNA.
 *
 * A2A is the Linux-Foundation agent-to-agent interop standard that every
 * major framework already ships (Google ADK, LangGraph, CrewAI, LlamaIndex,
 * AutoGen, Semantic Kernel). It defines an Agent Card at
 * `/.well-known/agent-card.json` and a JSON-RPC 2.0 transport
 * (`message/send`, `tasks/get`, …).
 *
 * What A2A does NOT define — and what SIGNA adds — is a wallet-signed
 * transport with an undeletable, re-verifiable message log, plus onchain
 * identity (ERC-8004) and payments (x402). So SIGNA is "the A2A transport
 * where every message is EIP-191 wallet-signed and persisted forever."
 *
 * Any A2A client can therefore discover + message a SIGNA agent with zero
 * SIGNA-specific code — it just speaks A2A.
 */
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, toBytes, type Hex } from "viem";

export const A2A_PROTOCOL_VERSION = "0.3.0";
export const BASE_URL = "https://www.signaagent.xyz";

// ───────── A2A v0.3.0 types (the subset we implement) ─────────

export interface A2APart {
  kind: "text" | "data" | "file";
  text?: string;
  data?: Record<string, unknown>;
}

export interface A2AMessage {
  kind: "message";
  role: "user" | "agent";
  parts: A2APart[];
  messageId: string;
  contextId?: string;
  taskId?: string;
  metadata?: Record<string, unknown>;
}

export type A2ATaskState =
  | "submitted"
  | "working"
  | "input-required"
  | "completed"
  | "canceled"
  | "failed"
  | "rejected"
  | "auth-required"
  | "unknown";

export interface A2ATask {
  kind: "task";
  id: string;
  contextId: string;
  status: {
    state: A2ATaskState;
    timestamp: string;
    message?: A2AMessage;
  };
  artifacts: unknown[];
  history: A2AMessage[];
}

// ───────── deterministic A2A gateway wallet ─────────
// Public attestation identity (no funds). Signs the envelope when SIGNA
// relays an inbound A2A message into an agent's wallet-signed inbox, so
// even messages from non-crypto A2A agents get a re-verifiable log entry.

export function a2aGatewayAccount() {
  const pk = keccak256(toBytes("signa-a2a-gateway-v1")) as Hex;
  return privateKeyToAccount(pk);
}

// ───────── helpers ─────────

export function extractText(msg: A2AMessage | undefined | null): string {
  if (!msg?.parts) return "";
  return msg.parts
    .filter((p) => p.kind === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("\n")
    .trim();
}

/** Deterministic-ish ids without Math.random (route handlers stamp time). */
export function genId(prefix: string, seed: string): string {
  const h = keccak256(toBytes(`${prefix}:${seed}`)).slice(2, 34);
  return `${prefix}-${h.slice(0, 8)}-${h.slice(8, 16)}-${h.slice(16, 24)}`;
}

export function agentMessage(text: string, messageId: string, contextId?: string): A2AMessage {
  return {
    kind: "message",
    role: "agent",
    parts: [{ kind: "text", text }],
    messageId,
    ...(contextId ? { contextId } : {}),
  };
}

export function completedTask(args: {
  taskId: string;
  contextId: string;
  replyText: string;
  replyMessageId: string;
  inbound?: A2AMessage;
  state?: A2ATaskState;
  nowIso: string;
}): A2ATask {
  const statusMsg = agentMessage(args.replyText, args.replyMessageId, args.contextId);
  return {
    kind: "task",
    id: args.taskId,
    contextId: args.contextId,
    status: {
      state: args.state ?? "completed",
      timestamp: args.nowIso,
      message: statusMsg,
    },
    artifacts: [],
    history: args.inbound ? [args.inbound, statusMsg] : [statusMsg],
  };
}

export function jsonRpcResult(id: string | number | null, result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

export function jsonRpcError(id: string | number | null, code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

// A2A's wallet-signed security scheme — our differentiated extension.
// Declared as an apiKey-style header carrying an EIP-191 signature. Clients
// that don't sign still work (delivery is gateway-attested); clients that
// DO sign get end-to-end attributable provenance.
export const SIGNA_SECURITY_SCHEMES = {
  signaWalletSig: {
    type: "apiKey",
    in: "header",
    name: "X-SIGNA-Signature",
    description:
      "Optional EIP-191 personal_sign over the SIGNA canonical preimage. When present, the message is attributable end-to-end to the sender's wallet; when absent, SIGNA relays + signs a gateway attestation so the message is still logged immutably.",
  },
} as const;

export interface AgentCardOpts {
  name: string;
  description: string;
  /** JSON-RPC endpoint URL (the A2A transport). */
  url: string;
  skills: Array<{
    id: string;
    name: string;
    description: string;
    tags: string[];
    examples?: string[];
  }>;
  /** signa-specific metadata appended under `metadata`. */
  metadata?: Record<string, unknown>;
  version?: string;
}

/** A spec-correct A2A v0.3.0 Agent Card. */
export function buildAgentCard(opts: AgentCardOpts) {
  return {
    protocolVersion: A2A_PROTOCOL_VERSION,
    name: opts.name,
    description: opts.description,
    url: opts.url,
    preferredTransport: "JSONRPC",
    version: opts.version ?? "1.0.0",
    provider: {
      organization: "SIGNA",
      url: BASE_URL,
    },
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: true,
    },
    defaultInputModes: ["text/plain", "application/json"],
    defaultOutputModes: ["text/plain", "application/json"],
    skills: opts.skills.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      tags: s.tags,
      examples: s.examples ?? [],
      inputModes: ["text/plain"],
      outputModes: ["text/plain"],
    })),
    securitySchemes: SIGNA_SECURITY_SCHEMES,
    security: [],
    documentationUrl: `${BASE_URL}/a2a`,
    ...(opts.metadata ? { metadata: opts.metadata } : {}),
  };
}
