/**
 * SIGNA × B20 — the verifiable launch + receipt layer for Base's native token standard.
 *
 * B20 (shipped with Base's Beryl upgrade) is a chain-native token standard: tokens are
 * minted through the B20Factory precompile rather than a deployed contract — ~50% cheaper
 * transfers, ~2× throughput, far cheaper creation. They are fully ERC-20 compatible.
 *
 * SIGNA never custodies funds, so it does NOT mint on a user's behalf. Instead it:
 *   1. builds the exact `createB20(...)` calldata the user's own wallet broadcasts, and
 *   2. issues a wallet-signed, re-verifiable B20 *launch receipt* binding
 *      {creator, variant, name, symbol, decimals/currency, salt, params, predicted address}
 *      under the deterministic `signa:b20-launch:v1` attestor — re-checkable by anyone via
 *      the universal verifier (kind "b20_launch"). x402 moved the money, B20 mints the
 *      token, SIGNA proves who launched what. Don't trust, verify.
 *
 * Server-only (node:crypto + a deterministic signer key). The /b20 page talks to /api/b20.
 */
import {
  createPublicClient, http, keccak256, toBytes,
  encodeAbiParameters, encodeFunctionData, type Address, type Hex,
} from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createHash } from "node:crypto";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// ── B20 protocol constants (Base Beryl) ───────────────────────────────────────
export const B20_FACTORY = "0xB20f000000000000000000000000000000000000" as Address;
export const B20_VARIANT = { ASSET: 0, STABLECOIN: 1 } as const;
export type B20Variant = keyof typeof B20_VARIANT;
export const B20_PARAMS_VERSION = 1; // leading version byte of the create-params struct
export const B20_NETWORK = "eip155:8453";

export const B20_FACTORY_ABI = [
  { type: "function", name: "createB20", stateMutability: "payable",
    inputs: [
      { name: "variant", type: "uint8" }, { name: "salt", type: "bytes32" },
      { name: "params", type: "bytes" }, { name: "initCalls", type: "bytes[]" }],
    outputs: [{ name: "token", type: "address" }] },
  { type: "function", name: "getB20Address", stateMutability: "view",
    inputs: [{ name: "variant", type: "uint8" }, { name: "sender", type: "address" }, { name: "salt", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "isB20", stateMutability: "view",
    inputs: [{ name: "token", type: "address" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "isB20Initialized", stateMutability: "view",
    inputs: [{ name: "token", type: "address" }], outputs: [{ name: "", type: "bool" }] },
] as const;

const ERC20_ABI = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const ASSET_PARAMS = [{ type: "tuple", components: [
  { name: "version", type: "uint8" }, { name: "name", type: "string" }, { name: "symbol", type: "string" },
  { name: "initialAdmin", type: "address" }, { name: "decimals", type: "uint8" }] }] as const;
const STABLECOIN_PARAMS = [{ type: "tuple", components: [
  { name: "version", type: "uint8" }, { name: "name", type: "string" }, { name: "symbol", type: "string" },
  { name: "initialAdmin", type: "address" }, { name: "currency", type: "string" }] }] as const;

// typed `any` on purpose: the monorepo resolves multiple viem copies, so a pinned
// PublicClient type clashes ("two different types with this name"). Runtime is identical.
let _client: any = null;
function client(): any {
  if (!_client) _client = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL || "https://mainnet.base.org") });
  return _client;
}

const isAddr = (a: string) => /^0x[a-fA-F0-9]{40}$/.test(a);

/** Heuristic: B20 token addresses carry a structural 0xb2… prefix. Authoritative check is isB20OnChain(). */
export function looksLikeB20(addr: string): boolean {
  return /^0xb2/i.test((addr || "").trim());
}

/** Deterministic salt so a launch is reproducible from its inputs (and bound into the receipt). */
export function b20Salt(creator: string, symbol: string, ts: number): Hex {
  return keccak256(toBytes(`signa:b20:${creator.toLowerCase()}:${symbol}:${ts}`));
}

export type B20LaunchSpec = {
  variant: B20Variant;     // "ASSET" | "STABLECOIN"
  name: string;
  symbol: string;
  creator: string;         // the wallet that will broadcast + own the token (initialAdmin)
  decimals?: number;       // ASSET only (6..18, default 18)
  currency?: string;       // STABLECOIN only (ISO-style A–Z, e.g. "USD")
  ts: number;
};

/** ABI-encode the variant-specific create-params struct (the `params` bytes for createB20). */
export function encodeB20Params(spec: B20LaunchSpec): Hex {
  const admin = spec.creator as Address;
  if (spec.variant === "STABLECOIN") {
    const currency = (spec.currency || "USD").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8) || "USD";
    return encodeAbiParameters(STABLECOIN_PARAMS, [{ version: B20_PARAMS_VERSION, name: spec.name, symbol: spec.symbol, initialAdmin: admin, currency }]);
  }
  const decimals = Math.min(Math.max(Math.round(spec.decimals ?? 18), 6), 18);
  return encodeAbiParameters(ASSET_PARAMS, [{ version: B20_PARAMS_VERSION, name: spec.name, symbol: spec.symbol, initialAdmin: admin, decimals }]);
}

/** Build the unsigned transaction the user's wallet broadcasts to mint the B20 token. */
export function buildCreateB20Tx(spec: B20LaunchSpec): { to: Address; data: Hex; value: string; salt: Hex; params: Hex } {
  const salt = b20Salt(spec.creator, spec.symbol, spec.ts);
  const params = encodeB20Params(spec);
  const data = encodeFunctionData({
    abi: B20_FACTORY_ABI, functionName: "createB20",
    args: [B20_VARIANT[spec.variant], salt, params, []],
  });
  return { to: B20_FACTORY, data, value: "0", salt, params };
}

/** Ask the precompile for the deterministic token address (best-effort — needs a Beryl-aware RPC). */
export async function predictB20Address(spec: B20LaunchSpec): Promise<string | null> {
  try {
    const salt = b20Salt(spec.creator, spec.symbol, spec.ts);
    const addr = await client().readContract({
      address: B20_FACTORY, abi: B20_FACTORY_ABI, functionName: "getB20Address",
      args: [B20_VARIANT[spec.variant], spec.creator as Address, salt],
    });
    return (addr as string).toLowerCase();
  } catch { return null; }
}

export async function isB20OnChain(addr: string): Promise<boolean | null> {
  if (!isAddr(addr)) return null;
  try {
    return (await client().readContract({ address: B20_FACTORY, abi: B20_FACTORY_ABI, functionName: "isB20", args: [addr as Address] })) as boolean;
  } catch { return null; }
}

/** Read a B20 (or any ERC-20) token's metadata from Base. Best-effort; nulls on failure. */
export async function b20Info(addr: string, holder?: string): Promise<Record<string, unknown>> {
  if (!isAddr(addr)) throw new Error("b20.info needs a token address (0x…40)");
  const a = addr as Address;
  const read = async (fn: "name" | "symbol" | "decimals" | "totalSupply") => {
    try { return await client().readContract({ address: a, abi: ERC20_ABI, functionName: fn }); } catch { return null; }
  };
  const [name, symbol, decimals, totalSupply, is_b20] = await Promise.all([
    read("name"), read("symbol"), read("decimals"), read("totalSupply"), isB20OnChain(addr),
  ]);
  let balance: string | null = null;
  if (holder && isAddr(holder)) {
    try { balance = ((await client().readContract({ address: a, abi: ERC20_ABI, functionName: "balanceOf", args: [holder as Address] })) as bigint).toString(); } catch {}
  }
  return {
    address: addr.toLowerCase(),
    is_b20: is_b20 ?? looksLikeB20(addr),
    is_b20_confirmed_onchain: is_b20,
    name: name ?? null,
    symbol: symbol ?? null,
    decimals: decimals != null ? Number(decimals) : null,
    total_supply_raw: totalSupply != null ? (totalSupply as bigint).toString() : null,
    holder: holder && isAddr(holder) ? holder.toLowerCase() : null,
    balance_raw: balance,
    network: B20_NETWORK,
    chain: "base",
  };
}

// ── the verifiable B20 launch receipt ─────────────────────────────────────────
const B20_ATTESTOR = privateKeyToAccount(keccak256(toBytes("signa:b20-launch:v1")));
export const B20_LAUNCH_SIGNER = B20_ATTESTOR.address.toLowerCase();

export type B20LaunchReceiptFields = {
  ts: number; creator: string; variant: B20Variant; name: string; symbol: string;
  decimals: number | null; currency: string | null; salt: string; params_hash: string; address: string | null;
};

/** Canonical preimage — MUST match the b20_launch case in verify-artifact.ts byte-for-byte. */
export function b20LaunchPreimage(a: B20LaunchReceiptFields): string {
  return [
    "SIGNA b20 launch v1",
    `ts:${a.ts}`,
    `creator:${a.creator.toLowerCase()}`,
    `variant:${a.variant}`,
    `name:${a.name}`,
    `symbol:${a.symbol}`,
    `decimals:${a.decimals ?? ""}`,
    `currency:${a.currency ?? ""}`,
    `salt:${a.salt}`,
    `params:${a.params_hash}`,
    `address:${(a.address ?? "").toLowerCase()}`,
  ].join("\n");
}

export type B20LaunchReceipt = B20LaunchReceiptFields & {
  signer: string; signature: string; signed_message: string;
  reverify: Record<string, unknown>;
};

/** Issue a wallet-signed, re-verifiable B20 launch receipt for a spec (+ predicted address). */
export async function issueB20LaunchReceipt(spec: B20LaunchSpec, predicted: string | null): Promise<B20LaunchReceipt> {
  const params = encodeB20Params(spec);
  const fields: B20LaunchReceiptFields = {
    ts: spec.ts,
    creator: spec.creator.toLowerCase(),
    variant: spec.variant,
    name: spec.name,
    symbol: spec.symbol,
    decimals: spec.variant === "ASSET" ? Math.min(Math.max(Math.round(spec.decimals ?? 18), 6), 18) : null,
    currency: spec.variant === "STABLECOIN" ? (spec.currency || "USD").toUpperCase() : null,
    salt: b20Salt(spec.creator, spec.symbol, spec.ts),
    params_hash: sha256(params),
    address: predicted ? predicted.toLowerCase() : null,
  };
  const signed_message = b20LaunchPreimage(fields);
  const signature = await B20_ATTESTOR.signMessage({ message: signed_message });
  return {
    ...fields,
    signer: B20_LAUNCH_SIGNER,
    signature,
    signed_message,
    reverify: { kind: "b20_launch", ...fields, signature },
  };
}

// ── verifiable money-messages: B20 transferWithMemo carries a wallet-signed note ─
// B20's transferWithMemo(to, amount, bytes32 memo) lets a transfer carry a 32-byte
// memo on-chain. We turn that memo into a commitment to a wallet-signed note:
// memo = keccak256(canonical note preimage). The transfer commits on-chain to a note
// that the PAYER signed; anyone recovers the payer and reads the proven note, bound to
// the transfer by the on-chain Memo event. "On B20, money can talk — SIGNA proves it."
export const B20_MEMO_ABI = [
  { type: "function", name: "transferWithMemo", stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }, { name: "memo", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }] },
  { type: "event", name: "Memo", inputs: [{ name: "caller", type: "address", indexed: true }, { name: "memo", type: "bytes32", indexed: true }] },
] as const;

export type B20NoteFields = { ts: number; from: string; to: string; token: string; amount: string; note: string };

/** Canonical preimage for a B20 money-note — MUST match the b20_memo case in verify-artifact.ts. */
export function b20NotePreimage(a: B20NoteFields): string {
  return [
    "SIGNA b20 memo v1",
    `ts:${a.ts}`,
    `from:${a.from.toLowerCase()}`,
    `to:${a.to.toLowerCase()}`,
    `token:${a.token.toLowerCase()}`,
    `amount:${a.amount}`,
    `note:${sha256(a.note)}`,
  ].join("\n");
}

/** The on-chain memo (bytes32) that commits to the signed note: keccak256(preimage). */
export function b20MemoHash(preimage: string): Hex {
  return keccak256(toBytes(preimage));
}

/** Build the transferWithMemo tx the payer's wallet broadcasts (memo = note commitment). */
export function buildTransferWithMemoTx(token: string, to: string, amount: string, memo: Hex): { to: Address; data: Hex; value: string } {
  const data = encodeFunctionData({ abi: B20_MEMO_ABI, functionName: "transferWithMemo", args: [to as Address, BigInt(amount), memo] });
  return { to: token as Address, data, value: "0" };
}

/** Build an unsigned B20 money-note: the preimage the PAYER signs, the on-chain memo, and the
 *  transferWithMemo calldata. SIGNA holds no key here — the payer's wallet (or agent key) signs the
 *  note and broadcasts the transfer; verification recovers the payer. */
export function buildB20Note(a: B20NoteFields): { preimage: string; memo: Hex; note_hash: string; tx: { to: Address; data: Hex; value: string }; reverify: Record<string, unknown> } {
  const preimage = b20NotePreimage(a);
  const memo = b20MemoHash(preimage);
  const note_hash = sha256(a.note);
  return {
    preimage, memo, note_hash,
    tx: buildTransferWithMemoTx(a.token, a.to, a.amount, memo),
    // caller fills `signature` after the payer signs `preimage`, then POSTs to /api/verify
    reverify: { kind: "b20_memo", ts: a.ts, from: a.from.toLowerCase(), to: a.to.toLowerCase(), token: a.token.toLowerCase(), amount: a.amount, note_hash },
  };
}

// ── verifiable stablecoins: the issuer signs a re-checkable reserve attestation ─
// B20 ships a native STABLECOIN variant. SIGNA lets the issuer publish a timestamped,
// wallet-signed reserve statement — "this stablecoin is backed by X of asset Y, as of T" —
// that anyone can re-verify (kind b20_reserves), recovering the issuer. This is provenance
// of the issuer's claim (who attested, what, and when), not a third-party audit. Honest by design.
export type B20ReservesFields = { ts: number; token: string; issuer: string; reserve_amount: string; reserve_asset: string; statement: string; as_of: number };

/** Canonical preimage for a B20 reserve attestation — MUST match the b20_reserves case in verify-artifact.ts. */
export function b20ReservesPreimage(a: B20ReservesFields): string {
  return [
    "SIGNA b20 reserves v1",
    `ts:${a.ts}`,
    `token:${a.token.toLowerCase()}`,
    `issuer:${a.issuer.toLowerCase()}`,
    `reserve:${a.reserve_amount} ${a.reserve_asset}`,
    `as_of:${a.as_of}`,
    `statement:${sha256(a.statement)}`,
  ].join("\n");
}

/** Build an unsigned reserve attestation: the preimage the ISSUER signs + the reverify payload. */
export function buildB20Reserves(a: B20ReservesFields): { preimage: string; statement_hash: string; reverify: Record<string, unknown> } {
  const preimage = b20ReservesPreimage(a);
  const statement_hash = sha256(a.statement);
  return {
    preimage, statement_hash,
    reverify: { kind: "b20_reserves", ts: a.ts, token: a.token.toLowerCase(), issuer: a.issuer.toLowerCase(), reserve_amount: a.reserve_amount, reserve_asset: a.reserve_asset, as_of: a.as_of, statement_hash },
  };
}
