/**
 * v0.84 — client-side x402 payment for paid DMs.
 *
 * When a DM to a priced inbox returns HTTP 402, this module turns the
 * advertised payment requirements into a Permit2 `permitWitnessTransferFrom`
 * signature (gasless — a typed-data sign, not a broadcast) and packs it into
 * the base64 X-PAYMENT header the server expects.
 *
 * Why Permit2 and not EIP-3009: USDG (Robinhood Chain's native stablecoin)
 * implements neither EIP-3009 nor EIP-2612 (verified on-chain by bytecode
 * selector scan). Permit2 is deployed at the same canonical address on every
 * EVM chain and works with ANY ERC-20 that has approved it — the payer does
 * a one-time `approve(PERMIT2, max)` on the asset, then every payment after
 * that is a pure signature.
 *
 * The signature authorizes `spender` (the recipient's own wallet, in SIGNA's
 * default non-custodial flow — no facilitator required) to pull `amount`
 * base units of `token` from the sender, to `payTo`. The sender never
 * broadcasts a tx; settlement happens out of band. The signing wallet's
 * funds only move when the recipient redeems it.
 */
// Accepts any SIGNA signer — a local key OR a custody-delegated signer.
import type { SignaSigner as PrivateKeyAccount } from "./signer.js";
import { keccak256, toBytes, type Hex } from "viem";

/** Canonical Permit2 address — identical on every EVM chain (CREATE2-deployed). */
export const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;

/** Scopes a Permit2 witness signature to SIGNA's paid-DM surface — must match web/lib/permit2.ts's `serviceId("paid-dm")`. */
export const PAID_DM_SERVICE_ID: Hex = keccak256(toBytes("signa:x402:paid-dm:v1"));

export interface PaymentRequirements {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra: { serviceId: Hex; permit2: string };
}

export interface Challenge402 {
  x402Version: number;
  error: string;
  accepts: PaymentRequirements[];
}

export function networkToChainId(network: string): number {
  const m = network.match(/^eip155:(\d+)$/);
  if (m) return Number(m[1]);
  throw new Error(`unsupported network ${network}`);
}

/** 32-byte random value as 0x-hex, using webcrypto (browser + node 20+) — used as both the EIP-3009-style nonce input and the Permit2 uint256 nonce. */
function randomHex32(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return ("0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")) as Hex;
}

function bytesToBase64(s: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(s, "utf8").toString("base64");
  return btoa(s);
}

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

/**
 * Build the X-PAYMENT header value satisfying a 402 challenge.
 *
 * @param account  the sender's viem account (signs the authorization)
 * @param challenge the 402 body the server returned
 * @param opts.validForSeconds how long the authorization stays valid (default 600s)
 */
export async function buildPaymentHeader(
  account: PrivateKeyAccount,
  challenge: Challenge402,
  opts: { validForSeconds?: number } = {},
): Promise<string> {
  const req = challenge.accepts?.[0];
  if (!req) throw new Error("402 challenge had no accepts[]");
  if (req.scheme !== "exact") {
    throw new Error(`unsupported payment scheme ${req.scheme}`);
  }

  const chainId = networkToChainId(req.network);
  const nowSec = Math.floor(Date.now() / 1000);
  const validForSeconds = opts.validForSeconds ?? 600;

  const owner = account.address.toLowerCase();
  const spender = req.payTo.toLowerCase(); // recipient redeems its own payment
  const nonce = BigInt(randomHex32());
  const deadline = BigInt(nowSec + validForSeconds);

  const message = {
    permitted: { token: req.asset as Hex, amount: BigInt(req.maxAmountRequired) },
    spender: spender as Hex,
    nonce,
    deadline,
    witness: { to: spender as Hex, serviceId: req.extra.serviceId },
  };

  const domain = {
    name: "Permit2",
    chainId,
    verifyingContract: (req.extra.permit2 ?? PERMIT2_ADDRESS) as Hex,
  } as const;

  const signature = await account.signTypedData({
    domain,
    types: PERMIT2_WITNESS_TYPES,
    primaryType: "PermitWitnessTransferFrom",
    message,
  });

  const authorization = {
    owner,
    spender,
    to: spender,
    token: req.asset.toLowerCase(),
    amount: req.maxAmountRequired,
    nonce: nonce.toString(),
    deadline: deadline.toString(),
  };

  const payload = {
    x402Version: challenge.x402Version ?? 2,
    scheme: "exact",
    network: req.network,
    payload: { signature, authorization },
  };

  return bytesToBase64(JSON.stringify(payload));
}
