/**
 * v0.96 — x402 decentralized inference for SIGNA agents.
 *
 * SIGNA agents already speak x402 + USDC on Base. This lets them ALSO
 * *think* on decentralized, pay-per-call inference instead of a single
 * centralized API — composing with the x402 inference marketplaces in
 * the Base agent stack. Provider-agnostic: Surplus Intelligence is the
 * first wired provider (live, 177 models incl. Claude Opus), but the
 * adapter is generic to any x402 OpenAI-compatible inference endpoint,
 * so this is composability with the x402 Bazaar, not a bet on one token.
 *
 * Auth model is x402 (pay-per-call), NOT an API key: the chat endpoint
 * returns a 402 challenge; the caller signs an EIP-3009 USDC
 * authorization (the same exact scheme SIGNA's paid-DM uses) and retries
 * with the X-PAYMENT header. Verifying the catalog + challenge needs no
 * funds; only a settled inference call spends USDC.
 */
import type { PrivateKeyAccount } from "viem/accounts";
import type { Hex } from "viem";

export interface X402InferenceProvider {
  id: string;
  label: string;
  /** OpenAI-compatible base (no trailing slash). */
  base: string;
  /** Where the project lives. */
  homepage: string;
}

export const X402_INFERENCE_PROVIDERS: Record<string, X402InferenceProvider> = {
  surplus: {
    id: "surplus",
    label: "Surplus Intelligence",
    base: "https://www.surplusintelligence.ai/x402/api/inference/v1",
    homepage: "https://surplusintelligence.ai",
  },
};

export interface X402Model {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
}

/** List the models an x402 inference provider offers (public, no payment). */
export async function listModels(providerId = "surplus"): Promise<X402Model[]> {
  const p = X402_INFERENCE_PROVIDERS[providerId];
  if (!p) throw new Error(`unknown x402 inference provider ${providerId}`);
  const r = await fetch(`${p.base}/models`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`${providerId} /models HTTP ${r.status}`);
  const j = await r.json();
  return (j?.data ?? []) as X402Model[];
}

export interface X402InferenceChallenge {
  version: number;
  model: string;
  estimatedCostUsd?: string;
  amount: string;
  currency: string;
  network: string;
  payTo: string;
  asset: string;
}

/**
 * Probe the chat endpoint without payment to retrieve the x402 challenge
 * (proves the provider is reachable + x402-gated, no funds needed).
 */
export async function getInferenceChallenge(
  model: string,
  providerId = "surplus",
): Promise<X402InferenceChallenge | null> {
  const p = X402_INFERENCE_PROVIDERS[providerId];
  if (!p) throw new Error(`unknown x402 inference provider ${providerId}`);
  const r = await fetch(`${p.base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: "ping" }], max_tokens: 4 }),
    signal: AbortSignal.timeout(15_000),
  });
  if (r.status !== 402) return null;
  const j = await r.json().catch(() => ({}));
  const x = j?.x402;
  if (!x?.amount || !x?.payTo || !x?.asset) return null;
  return {
    version: x.version ?? 2,
    model: x.model ?? model,
    estimatedCostUsd: x.estimatedCostUsd,
    amount: String(x.amount),
    currency: x.currency ?? "USDC",
    network: x.network ?? "base",
    payTo: x.payTo,
    asset: x.asset,
  };
}

// ───────── EIP-3009 payment (the paying side; same exact scheme as paid-DMs) ─────────

function b64(s: string): string {
  return typeof Buffer !== "undefined" ? Buffer.from(s, "utf8").toString("base64") : btoa(s);
}
function randomNonce(): Hex {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return ("0x" + Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("")) as Hex;
}

/**
 * Sign + run one inference call through an x402 provider. Costs real USDC
 * (~the challenge amount) settled to the provider's payTo. Requires a
 * FUNDED account. Returns the assistant text.
 *
 * The signing wallet authorizes an EIP-3009 USDC transfer to the
 * provider; the provider's facilitator settles it. SIGNA holds nothing.
 */
export async function payAndInfer(args: {
  account: PrivateKeyAccount;
  model: string;
  messages: Array<{ role: string; content: string }>;
  providerId?: string;
  maxTokens?: number;
}): Promise<string> {
  const providerId = args.providerId ?? "surplus";
  const p = X402_INFERENCE_PROVIDERS[providerId];
  const ch = await getInferenceChallenge(args.model, providerId);
  if (!ch) throw new Error("no x402 challenge from provider");
  const chainId = ch.network === "base" ? 8453 : 84532;
  const nowSec = Math.floor(Date.now() / 1000);

  const authorization = {
    from: args.account.address.toLowerCase(),
    to: ch.payTo.toLowerCase(),
    value: ch.amount,
    validAfter: "0",
    validBefore: String(nowSec + 600),
    nonce: randomNonce(),
  };
  const signature = await args.account.signTypedData({
    domain: { name: "USD Coin", version: "2", chainId, verifyingContract: ch.asset as Hex },
    types: {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    primaryType: "TransferWithAuthorization",
    message: {
      from: authorization.from as Hex,
      to: authorization.to as Hex,
      value: BigInt(authorization.value),
      validAfter: 0n,
      validBefore: BigInt(authorization.validBefore),
      nonce: authorization.nonce,
    },
  });
  const xPayment = b64(JSON.stringify({ x402Version: ch.version, scheme: "exact", network: `eip155:${chainId}`, payload: { signature, authorization } }));

  const r = await fetch(`${p.base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-payment": xPayment },
    body: JSON.stringify({ model: args.model, messages: args.messages, max_tokens: args.maxTokens ?? 200 }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!r.ok) throw new Error(`inference ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return (j?.choices?.[0]?.message?.content ?? "").trim();
}
