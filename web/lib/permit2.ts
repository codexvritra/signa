/**
 * Permit2 witness-transfer — the signing scheme x402 "exact" payments use on
 * Robinhood Chain, replacing EIP-3009 (which USDC on Base supported natively
 * but which USDG does NOT implement — verified on-chain by bytecode selector
 * scan: USDG has neither EIP-3009 nor EIP-2612).
 *
 * Permit2 (https://github.com/Uniswap/permit2) is deployed at the same
 * canonical address on every EVM chain, including Robinhood Chain (verified
 * via its own DOMAIN_SEPARATOR() against chain id 4663). Instead of a
 * per-token EIP-712 domain (what EIP-3009 needed), there is ONE domain valid
 * for every ERC-20 — the token itself is just a field (`permitted.token`)
 * inside the signed message. The payer does a one-time `approve(PERMIT2,
 * max)` on the token (standard Permit2 UX); after that every payment is a
 * pure off-chain signature, same as before.
 *
 * Witness shape: matches the convention already live on Robinhood Chain's
 * Canopy x402 facilitator (facilitator.canopyfinance.io) — `X402Witness(address
 * to, bytes32 serviceId)` — rather than inventing a SIGDA-specific shape, so
 * a signed payment stays interoperable with other x402 facilitators on this
 * chain. `to` binds the actual payee (Permit2's own fields only commit a
 * `spender` — the address allowed to call permitWitnessTransferFrom — which
 * may be a facilitator relaying on the payee's behalf, not the payee itself);
 * `serviceId` scopes the signature to one SIGDA payment surface so it can't
 * be replayed as payment for a different service.
 */
import { keccak256, encodeAbiParameters, toBytes, type Address, type Hex } from "viem";

/** Canonical Permit2 address — identical on every EVM chain (CREATE2-deployed). */
export const PERMIT2_ADDRESS: Address = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

export function permit2Domain(chainId: number) {
  return { name: "Permit2", chainId, verifyingContract: PERMIT2_ADDRESS } as const;
}

/** EIP-712 types for permitWitnessTransferFrom with an X402Witness. */
export const PERMIT2_WITNESS_TYPES = {
  TokenPermissions: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
  ],
  X402Witness: [
    { name: "to", type: "address" },
    { name: "serviceId", type: "bytes32" },
  ],
  PermitWitnessTransferFrom: [
    { name: "permitted", type: "TokenPermissions" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "witness", type: "X402Witness" },
  ],
} as const;

/** Stable per-surface service id — scopes a signature to one SIGDA payment kind. */
export function serviceId(surface: string): Hex {
  return keccak256(toBytes(`sigda:x402:${surface}:v1`));
}

export const PAID_DM_SERVICE_ID = serviceId("paid-dm");
/** Shared by every purchase that flows through the generic /api/x402/receipt endpoint. */
export const RECEIPT_SERVICE_ID = serviceId("receipt");

export interface Permit2WitnessMessage {
  permitted: { token: Address; amount: bigint };
  spender: Address;
  nonce: bigint;
  deadline: bigint;
  witness: { to: Address; serviceId: Hex };
}

/** Build the typed-data `message` object for signing/verifying a Permit2 witness transfer. */
export function buildPermit2WitnessMessage(a: {
  token: Address;
  amount: bigint;
  spender: Address;
  nonce: bigint;
  deadline: bigint;
  to: Address;
  serviceId: Hex;
}): Permit2WitnessMessage {
  return {
    permitted: { token: a.token, amount: a.amount },
    spender: a.spender,
    nonce: a.nonce,
    deadline: a.deadline,
    witness: { to: a.to, serviceId: a.serviceId },
  };
}

/**
 * The on-chain witness hash Permit2's `hashWithWitness` expects as its
 * `witness` calldata argument (a pre-hashed bytes32 — Permit2 itself never
 * parses witness contents). Only needed by code that actually BROADCASTS a
 * `permitWitnessTransferFrom` call; pure sign/verify (SIGDA's role) never
 * needs this; that side uses the full nested `witness: {to, serviceId}`
 * object in typed-data `message` so wallets display + hash it per normal
 * EIP-712 nested-struct rules.
 */
export function hashX402Witness(to: Address, sid: Hex): Hex {
  const typeHash = keccak256(toBytes("X402Witness(address to,bytes32 serviceId)"));
  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "address" }, { type: "bytes32" }],
      [typeHash, to, sid],
    ),
  );
}

/** The exact witnessTypeString a settlement contract must pass to Permit2 alongside the hash above. */
export const X402_WITNESS_TYPE_STRING =
  "X402Witness witness)TokenPermissions(address token,uint256 amount)X402Witness(address to,bytes32 serviceId)";
