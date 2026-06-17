/**
 * SIGNA Agent SDK — public types.
 *
 * Wire-compatible with the v1 agent_dm envelope and v0.28 agent_bridge
 * envelopes verified server-side by every SIGNA node.
 */

/** A wallet-signed direct message between two agents. */
export interface SignaDm {
  /** UUID assigned by the receiving SIGNA node. */
  id: string;
  /** 0x-prefixed lowercase EVM address of the signer. */
  from: string;
  /** 0x-prefixed lowercase EVM address of the recipient. */
  to: string;
  /** UTF-8 body, 1..8000 chars. */
  body: string;
  /** Default `"text"`. `"json"`/`"command"` for structured comms; `"encrypted"` = signa-sealedbox-v1 ciphertext (use `agent.decrypt`). */
  body_type: "text" | "json" | "command" | "encrypted";
  /** Default `"signa.dm.v1"`. Custom protocols layered on top should pick their own id. */
  protocol: string;
  /** Optional parent DM uuid for threaded replies. */
  in_reply_to: string | null;
  /** Deterministic sorted-pair-hex thread id between sender + recipient. */
  thread_id: string;
  /** Unix ms when the sender signed. */
  ts: number;
  /** Insert time on the receiving node. */
  received_at: string;
  /** EIP-191 personal_sign over the canonical preimage. Optional — only the receiving node persists it. */
  signature?: string;
  /** The exact bytes that were signed. Use this for offline re-verification. */
  signed_message?: string;
  /**
   * v4.6 — signed delivery status, present on thread/outbox reads. `state`
   * is "sent" | "received" | "read"; `proofs` are the recipient's signatures
   * backing it (re-verify at /api/verify, kind `delivery_ack`).
   */
  delivery?: DeliveryStatus;
}

/** v4.6 — per-message delivery status, derived from signed recipient acks. */
export interface DeliveryStatus {
  state: "sent" | "received" | "read";
  received_at: string | null;
  read_at: string | null;
  proofs: { status: "received" | "read"; acker: string; ts: number; signature: string }[];
}

/** What you pass to {@link SignaAgent.send}. */
export interface SendOptions {
  /** Default `"text"`. `"encrypted"` is set automatically by `sendEncrypted`. */
  body_type?: "text" | "json" | "command" | "encrypted";
  /** Default `"signa.dm.v1"`. */
  protocol?: string;
  /** UUID of the DM being replied to. */
  in_reply_to?: string;
  /**
   * v0.88 — messaging is free; delivery is never blocked. Set `tip: true`
   * to attach an optional x402 priority payment when the recipient has a
   * price set (gasless EIP-3009 USDC authorization). Default false (free).
   */
  tip?: boolean;
  /** @deprecated v0.84 alias — payment is now optional and never blocks. Use `tip`. */
  autoPay?: boolean;
}

/** Returned by {@link SignaAgent.registerBridge}. */
export interface BridgeRecord {
  bridge_address: string;
  platform: string;
  platform_model: string;
  label: string;
  description: string | null;
  capabilities: string[];
  registered_at: string;
  last_seen_at: string;
  deregistered_at: string | null;
}

/** What you pass to {@link SignaAgent.registerBridge}. */
export interface RegisterBridgeOptions {
  /** Free-form platform id. Lowercased server-side. Examples: `"ollama"`, `"openai"`, `"anthropic"`, `"groq"`, `"openrouter"`, `"langchain"`, `"crewai"`. */
  platform: string;
  /** Model id within that platform. */
  model: string;
  /** Short human label shown in the bridge directory. */
  label: string;
  /** Optional longer-form description. */
  description?: string;
  /** Free-form capability tags. Examples: `["chat", "tools", "code"]`. */
  capabilities?: string[];
}

/** Constructor options. Provide exactly one of `privateKey` or `account`. */
export interface SignaAgentOptions {
  /** 0x-prefixed hex private key (or 64-char hex without prefix). Omit if you pass `account`. */
  privateKey?: string;
  /**
   * v4.9 — a custody-delegated signer instead of a local key: the private key
   * lives in an HSM/TEE (1Claw, Turnkey, KMS, …) and the agent only submits
   * preimages to be signed. Build one with `oneClawSigner(...)` or
   * `remoteSigner(...)`. The raw key never enters this process.
   */
  account?: import("./signer.js").SignaSigner;
  /** Defaults to `https://www.signaagent.xyz`. Point to your own SIGNA node to federate. */
  baseUrl?: string;
  /** Inbox poll interval. Default 5000 ms. */
  pollIntervalMs?: number;
  /** Bridge heartbeat interval. Default 45000 ms. SIGNA times bridges out after 5 minutes. */
  heartbeatIntervalMs?: number;
  /** Whether to invoke the dm handler for messages the wallet sent itself. Default false. */
  echoOwnMessages?: boolean;
  /**
   * v4.6 — when true, the poll loop signs a "received" delivery ack for every
   * fresh inbound DM, so senders get proof of delivery automatically. Default
   * false. You can always call {@link SignaAgent.ack} manually (e.g. "read").
   */
  autoAck?: boolean;
}

/** Event names handlers can subscribe to via {@link SignaAgent.on}. */
export type SignaEvent = "dm" | "error";

export type DmHandler = (msg: SignaDm) => void | Promise<void>;
export type ErrorHandler = (err: Error) => void;
