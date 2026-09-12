/**
 * v0.84 — x402-paid DM verification (server-side, non-custodial).
 *
 * An inbox can carry a price. To DM a priced wallet, the sender attaches an
 * `X-PAYMENT` header carrying an x402 "exact" payload: a Permit2
 * `permitWitnessTransferFrom` signature authorizing `amount` base units of
 * `token` to be pulled from the sender, redeemable by `spender` (here, the
 * recipient's own wallet — see lib/permit2.ts for why Permit2 replaced
 * EIP-3009 on Robinhood Chain: USDG implements neither EIP-3009 nor
 * EIP-2612).
 *
 * SIGNA's role is to VERIFY the authorization is real and binding —
 * recover the signer from the typed-data signature, confirm it matches
 * the sender, pays the recipient the right amount of the right asset,
 * and the deadline is valid — then record it as the DM's payment
 * receipt. Settlement (broadcasting `permitWitnessTransferFrom` to pull
 * the funds) is a permissionless action the recipient performs out of
 * band, once they've done a one-time `approve(PERMIT2, max)` allowance
 * check on their own end (payer's one-time step, standard Permit2 UX).
 * SIGNA never holds funds, never pays gas, never custodies a key.
 *
 * This mirrors the x402 "exact" scheme exactly — the authorization IS
 * the payment instrument; verification and settlement are separable.
 */
import { verifyTypedData, type Address, type Hex } from "viem";
import {
  permit2Domain,
  PERMIT2_ADDRESS,
  PERMIT2_WITNESS_TYPES,
  PAID_DM_SERVICE_ID,
  buildPermit2WitnessMessage,
} from "./permit2";
import { RH_CHAIN_ID } from "./chain";

export const X402_VERSION = 2;

/** Networks we understand (CAIP-2). */
export const NETWORKS: Record<string, { chainId: number; label: string }> = {
  [`eip155:${RH_CHAIN_ID}`]: { chainId: RH_CHAIN_ID, label: "Robinhood Chain" },
};

/** Default asset for new priced inboxes — USDG, Robinhood Chain's native stablecoin. */
export const DEFAULT_ASSET_USDG = "0x5fc5360d0400a0fd4f2af552add042d716f1d168";

export interface InboxPrice {
  address: string;
  price_raw: string;
  pay_to: string;
  asset_address: string;
  asset_symbol: string;
  asset_decimals: number;
  chain: string;
}

export interface PaymentRequirements {
  scheme: "exact";
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra: { serviceId: Hex; permit2: Address };
}

/**
 * Build the HTTP 402 body advertising what the sender must pay.
 * `serviceId` scopes the payer's eventual signature to this specific payment
 * surface (defaults to the paid-DM id — pass e.g. a capability-invoke id for
 * other x402-priced surfaces that reuse this same challenge shape).
 */
export function build402Challenge(
  price: InboxPrice,
  resource: string,
  serviceIdOverride: Hex = PAID_DM_SERVICE_ID,
): { x402Version: number; error: string; accepts: PaymentRequirements[] } {
  return {
    x402Version: X402_VERSION,
    error: "payment_required",
    accepts: [
      {
        scheme: "exact",
        network: `eip155:${RH_CHAIN_ID}`,
        maxAmountRequired: price.price_raw,
        resource,
        description: `Paid DM to ${price.address}`,
        mimeType: "application/json",
        payTo: price.pay_to,
        maxTimeoutSeconds: 300,
        asset: price.asset_address,
        extra: { serviceId: serviceIdOverride, permit2: PERMIT2_ADDRESS },
      },
    ],
  };
}

export interface Permit2Authorization {
  owner: string;
  spender: string;
  token: string;
  amount: string;
  nonce: string;
  deadline: string;
  to: string;
}

export interface DecodedPayment {
  x402Version: number;
  scheme: string;
  network: string;
  payload: {
    signature: Hex;
    authorization: Permit2Authorization;
  };
}

/** Decode the base64 X-PAYMENT header into a typed payload. */
export function decodePaymentHeader(header: string): DecodedPayment | null {
  try {
    const json =
      typeof atob !== "undefined"
        ? atob(header)
        : Buffer.from(header, "base64").toString("utf8");
    const parsed = JSON.parse(json);
    if (!parsed?.payload?.authorization || !parsed?.payload?.signature) {
      return null;
    }
    return parsed as DecodedPayment;
  } catch {
    return null;
  }
}

export type VerifyPaymentResult =
  | { ok: true; authorization: Permit2Authorization; network: string; assetAddress: string }
  | { ok: false; reason: string };

/**
 * Fully verify an x402 "exact" payment against an inbox price.
 *
 * Checks (in order):
 *   1. scheme is "exact" and network is understood + matches the price
 *   2. authorization.owner == the declared DM sender
 *   3. authorization.spender == authorization.to == the price's payTo
 *      (recipient redeems their own payment — no third-party facilitator
 *      in SIGNA's default non-custodial flow)
 *   4. authorization.token == the price's asset
 *   5. authorization.amount >= the price (sender may over-pay, never under)
 *   6. now is within the deadline
 *   7. the EIP-712 signature (Permit2 domain, PermitWitnessTransferFrom
 *      primary type) recovers to authorization.owner
 *
 * Replay protection (nonce single-use) is enforced by the caller against
 * signa_dm_payment_nonces — it needs DB access, so it's not done here. (Note:
 * Permit2 also enforces on-chain single-use via its nonce bitmap, but SIGNA's
 * own DB check guards the off-chain "was this signature already used as a DM
 * payment receipt" question, which is independent of on-chain settlement.)
 */
export async function verifyExactPayment(args: {
  payment: DecodedPayment;
  price: InboxPrice;
  expectedFrom: string;
  nowSec?: number;
  expectedServiceId?: Hex;
}): Promise<VerifyPaymentResult> {
  const { payment, price, expectedFrom } = args;
  const expectedServiceId = args.expectedServiceId ?? PAID_DM_SERVICE_ID;
  const nowSec = args.nowSec ?? Math.floor(Date.now() / 1000);

  if (payment.scheme !== "exact") {
    return { ok: false, reason: "unsupported_scheme" };
  }
  const net = NETWORKS[payment.network];
  if (!net) return { ok: false, reason: "unsupported_network" };

  const expectedNetwork = `eip155:${RH_CHAIN_ID}`;
  if (payment.network !== expectedNetwork) {
    return { ok: false, reason: "network_mismatch" };
  }

  const auth = payment.payload.authorization;
  const owner = (auth.owner ?? "").toLowerCase();
  const spender = (auth.spender ?? "").toLowerCase();
  const to = (auth.to ?? "").toLowerCase();
  const token = (auth.token ?? "").toLowerCase();

  if (!/^0x[a-f0-9]{40}$/.test(owner)) {
    return { ok: false, reason: "invalid_authorization_owner" };
  }
  if (owner !== expectedFrom.toLowerCase()) {
    return { ok: false, reason: "payer_is_not_sender" };
  }
  if (to !== price.pay_to.toLowerCase() || spender !== price.pay_to.toLowerCase()) {
    return { ok: false, reason: "wrong_pay_to" };
  }
  if (token !== price.asset_address.toLowerCase()) {
    return { ok: false, reason: "wrong_asset" };
  }

  let amount: bigint;
  let required: bigint;
  try {
    amount = BigInt(auth.amount);
    required = BigInt(price.price_raw);
  } catch {
    return { ok: false, reason: "invalid_amount" };
  }
  if (amount < required) {
    return { ok: false, reason: "underpaid" };
  }

  let nonce: bigint;
  let deadline: bigint;
  try {
    nonce = BigInt(auth.nonce);
    deadline = BigInt(auth.deadline);
  } catch {
    return { ok: false, reason: "invalid_nonce_or_deadline" };
  }
  if (BigInt(nowSec) > deadline) {
    return { ok: false, reason: "authorization_expired" };
  }

  const message = buildPermit2WitnessMessage({
    token: token as Address,
    amount,
    spender: spender as Address,
    nonce,
    deadline,
    to: to as Address,
    serviceId: expectedServiceId,
  });

  let valid = false;
  try {
    valid = await verifyTypedData({
      address: owner as Address,
      domain: permit2Domain(net.chainId),
      types: PERMIT2_WITNESS_TYPES,
      primaryType: "PermitWitnessTransferFrom",
      message,
      signature: payment.payload.signature,
    });
  } catch (e) {
    return {
      ok: false,
      reason: `signature_verify_threw:${e instanceof Error ? e.message : String(e)}`,
    };
  }
  if (!valid) {
    return { ok: false, reason: "bad_signature" };
  }

  return {
    ok: true,
    authorization: auth,
    network: payment.network,
    assetAddress: price.asset_address,
  };
}

/**
 * Verify a standalone Permit2 witness-transfer signature recovers to
 * `owner`, for a given asset + network. Used by x402 receipts (no inbox
 * price). Mirrors the verification in verifyExactPayment.
 *
 * `expectedServiceId` is required (not defaulted) because it scopes the
 * signature to one payment surface — the caller must know and assert which
 * surface it's verifying for (e.g. the generic /api/x402/receipt endpoint
 * uses its own id, distinct from PAID_DM_SERVICE_ID).
 */
export async function verifyTransferAuthorization(args: {
  owner: string;
  spender: string;
  to: string;
  token: string;
  amount: string;
  nonce: string;
  deadline: string;
  signature: string;
  network: string;
  expectedServiceId: Hex;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const net = NETWORKS[args.network];
  if (!net) return { ok: false, reason: "unsupported_network" };
  if (!/^0x[a-f0-9]{40}$/i.test(args.owner)) return { ok: false, reason: "invalid_owner" };

  let amount: bigint;
  let nonce: bigint;
  let deadline: bigint;
  try {
    amount = BigInt(args.amount);
    nonce = BigInt(args.nonce);
    deadline = BigInt(args.deadline);
  } catch {
    return { ok: false, reason: "invalid_amount_nonce_or_deadline" };
  }

  const message = buildPermit2WitnessMessage({
    token: args.token as Address,
    amount,
    spender: args.spender as Address,
    nonce,
    deadline,
    to: args.to as Address,
    serviceId: args.expectedServiceId,
  });

  let valid = false;
  try {
    valid = await verifyTypedData({
      address: args.owner as Address,
      domain: permit2Domain(net.chainId),
      types: PERMIT2_WITNESS_TYPES,
      primaryType: "PermitWitnessTransferFrom",
      message,
      signature: args.signature as Hex,
    });
  } catch (e) {
    return { ok: false, reason: `sig_verify_threw:${e instanceof Error ? e.message : String(e)}` };
  }
  return valid ? { ok: true } : { ok: false, reason: "bad_authorization_signature" };
}

/** Human-readable price, e.g. "0.10 USDG". */
export function humanizePrice(price: InboxPrice): string {
  try {
    const raw = BigInt(price.price_raw);
    const base = 10n ** BigInt(price.asset_decimals);
    const whole = raw / base;
    const frac = raw % base;
    const fracStr = frac
      .toString()
      .padStart(price.asset_decimals, "0")
      .replace(/0+$/, "")
      .slice(0, 4);
    const num = fracStr ? `${whole}.${fracStr}` : `${whole}`;
    return `${num} ${price.asset_symbol}`;
  } catch {
    return `${price.price_raw} ${price.asset_symbol}`;
  }
}
