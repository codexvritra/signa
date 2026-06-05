/**
 * Agent spend mandates — the rail that lets a human safely fund an agent.
 *
 * Three wallet-signed primitives, all EIP-191, all re-verifiable:
 *   1. mandate        — the human grants a bounded budget to an agent.
 *   2. spend          — the agent records a spend against its mandate.
 *   3. budget request — the agent asks the human for more money.
 *
 * The point this answers (from the Base agentic-commerce debate): humans don't
 * fund agents because there's no safe way to — no bounded authority, no way for
 * the agent to ask, no verifiable record of what it spent. This is that rail.
 */

export const USDC_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
export const NETWORK_BASE = "eip155:8453";

export function mandatePreimage(a: {
  ts: number;
  grantor: string;
  agent: string;
  asset: string;
  network: string;
  limit: string;
  perTx: string;
  expiry: number;
  memo?: string;
}): string {
  return [
    "SIGNA spend mandate v1",
    `ts:${a.ts}`,
    `grantor:${a.grantor.toLowerCase()}`,
    `agent:${a.agent.toLowerCase()}`,
    `asset:${a.asset.toLowerCase()}`,
    `network:${a.network}`,
    `limit:${a.limit}`,
    `per_tx:${a.perTx}`,
    `expiry:${a.expiry}`,
    `memo:${a.memo ?? ""}`,
  ].join("\n");
}

export function spendPreimage(a: {
  ts: number;
  mandateId: string;
  agent: string;
  amount: string;
  note?: string;
}): string {
  return [
    "SIGNA spend v1",
    `ts:${a.ts}`,
    `mandate:${a.mandateId}`,
    `agent:${a.agent.toLowerCase()}`,
    `amount:${a.amount}`,
    `note:${a.note ?? ""}`,
  ].join("\n");
}

export function budgetRequestPreimage(a: {
  ts: number;
  agent: string;
  grantor: string;
  amount: string;
  goal?: string;
  reason?: string;
}): string {
  return [
    "SIGNA budget request v1",
    `ts:${a.ts}`,
    `agent:${a.agent.toLowerCase()}`,
    `grantor:${a.grantor.toLowerCase()}`,
    `amount:${a.amount}`,
    `goal:${a.goal ?? ""}`,
    `reason:${a.reason ?? ""}`,
  ].join("\n");
}

/** USDC base units -> "0.05 USDC" */
export function usdc(raw: string): string {
  try {
    return `${(Number(BigInt(raw)) / 1e6).toFixed(2)} USDC`;
  } catch {
    return `${raw}`;
  }
}

export type Mandate = {
  id: string;
  grantor: string;
  agent: string;
  asset: string;
  network: string;
  limit_raw: string;
  per_tx_raw: string;
  expiry: number;
  memo: string | null;
  signed_message: string;
  signature: string;
  created_at: string;
};
