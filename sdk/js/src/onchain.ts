/**
 * Onchain messaging — write a message INTO a Base transaction, with no SIGNA
 * node and no website in the loop. The message lives in the transaction's
 * calldata, on-chain, permanently; the transaction is signed by the sender's
 * wallet, so the chain itself proves who sent it. A 0-value tx to the recipient
 * with the message in `data`.
 *
 * This is the permissionless half of the SIGNA message layer: the protocol is
 * just "a Base tx whose calldata starts with `SIGNA msg v1`". Anyone — any
 * wallet, any language, any agent — can write and read these without asking
 * SIGNA. Sending costs gas (cents on Base); reading needs nothing but an RPC.
 */
import {
  createWalletClient,
  createPublicClient,
  http,
  toHex,
  hexToString,
  encodeFunctionData,
  parseAbiItem,
  type Hex,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

/** The canonical onchain-message prefix. A tx is a SIGNA message iff its calldata, decoded as UTF-8, starts with this. */
export const ONCHAIN_MSG_PREFIX = "SIGNA msg v1";

const DEFAULT_RPC = "https://mainnet.base.org";
const norm = (a: string): string => a.toLowerCase();

/** Build the calldata (hex) that encodes a SIGNA onchain message. */
export function buildOnchainMessageData(a: { from: string; to: string; body: string }): Hex {
  const canonical = `${ONCHAIN_MSG_PREFIX}\nfrom:${norm(a.from)}\nto:${norm(a.to)}\nbody:${a.body}`;
  return toHex(canonical);
}

/** Base mainnet chain id, as the hex string wallets expect for `wallet_switchEthereumChain` / `eth_sendTransaction`. */
export const BASE_CHAIN_ID_HEX = "0x2105"; // 8453

/**
 * Build the wallet-agnostic transaction REQUEST for an onchain message — the
 * exact `{ to, value, data, chainId }` any wallet (MetaMask, Rabby, OKX, Trust,
 * Coinbase, …) needs to send it. The user signs it in their OWN wallet; SIGNA
 * never touches the key. Feed `data` into a wallet's hex-data field, an
 * injected-provider `eth_sendTransaction`, or a WalletConnect request — all
 * produce the identical on-chain message. No website, no SIGNA node required.
 */
export function composeOnchain(a: { from: string; to: string; body: string }): {
  to: string;
  value: "0x0";
  data: Hex;
  chainId: string;
} {
  return { to: norm(a.to), value: "0x0", data: buildOnchainMessageData(a), chainId: BASE_CHAIN_ID_HEX };
}

/** Decode a transaction's calldata back into a SIGNA message, or null if it isn't one. */
export function decodeOnchainMessage(inputHex: string): { from: string; to: string; body: string } | null {
  try {
    if (!inputHex || inputHex === "0x") return null;
    const s = hexToString(inputHex as Hex);
    if (!s.startsWith(ONCHAIN_MSG_PREFIX)) return null;
    const from = norm((s.match(/\nfrom:([^\n]*)/)?.[1] ?? "").trim());
    const to = norm((s.match(/\nto:([^\n]*)/)?.[1] ?? "").trim());
    const i = s.indexOf("\nbody:");
    const body = i >= 0 ? s.slice(i + 6) : "";
    return { from, to, body };
  } catch {
    return null;
  }
}

export interface OnchainMessage {
  tx: string;
  tx_from: string;
  tx_to: string;
  from: string;
  to: string;
  body: string;
  block: string;
  /** True iff the transaction's own sender equals the claimed `from` — the chain's proof of authorship. */
  sender_matches: boolean;
}

/**
 * Read a SIGNA message straight back from a Base transaction hash — no SIGNA
 * node involved, just an RPC. Returns null if the tx isn't a SIGNA message.
 */
export async function readOnchainMessage(
  txHash: string,
  opts: { rpcUrl?: string } = {},
): Promise<OnchainMessage | null> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) return null;
  const client = createPublicClient({ chain: base, transport: http(opts.rpcUrl ?? DEFAULT_RPC) });
  let tx: { from: string; to: string | null; input: string; blockNumber: bigint | null };
  try {
    tx = await client.getTransaction({ hash: txHash as Hex });
  } catch {
    return null;
  }
  const msg = decodeOnchainMessage(tx.input);
  if (!msg) return null;
  const txFrom = norm(String(tx.from));
  return {
    tx: txHash,
    tx_from: txFrom,
    tx_to: norm(String(tx.to ?? "")),
    from: msg.from,
    to: msg.to,
    body: msg.body,
    block: String(tx.blockNumber ?? ""),
    sender_matches: txFrom === msg.from,
  };
}

/**
 * Broadcast a SIGNA onchain message from a local private key — writes it to
 * Base and returns the tx hash. The key must hold a little Base ETH for gas.
 * This is the only SIGNA primitive that needs a *local* key (a custody/remote
 * signer can sign messages but can't broadcast a transaction).
 */
export async function sendOnchainMessage(
  privateKey: string,
  args: { to: string; body: string; rpcUrl?: string },
): Promise<{ hash: string; from: string; to: string; explorer: string }> {
  if (!args.to || !/^0x[a-fA-F0-9]{40}$/.test(args.to)) {
    throw new Error(`sendOnchainMessage: invalid recipient "${args.to}"`);
  }
  if (!args.body || args.body.length === 0) {
    throw new Error("sendOnchainMessage: body is required");
  }
  const pk = (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as Hex;
  const account = privateKeyToAccount(pk);
  const from = norm(account.address);
  const to = norm(args.to);
  const wallet = createWalletClient({ account, chain: base, transport: http(args.rpcUrl ?? DEFAULT_RPC) });
  const data = buildOnchainMessageData({ from, to, body: args.body });
  const hash = await wallet.sendTransaction({ to: to as Hex, value: 0n, data });
  return { hash, from, to, explorer: `https://basescan.org/tx/${hash}` };
}

// ─────────────────── SignaMessages contract (readable Basescan events) ───────────────────

/**
 * The SignaMessages contract on Base. `send(to, body)` records a message as a
 * `Message(id, from, to, body, ts)` event — once verified on Basescan it renders
 * as readable, decoded activity, and the chain is the index (no node needed).
 */
export const SIGNA_MESSAGES_ADDRESS = "0x142770698171a8e76b6268963a5a531ec4b64ad9";
const SIGNA_MESSAGES_DEPLOY_BLOCK = 48007737n;
const SEND_ABI = [parseAbiItem("function send(address to, string body) returns (uint256)")] as const;
const MESSAGE_EVENT = parseAbiItem(
  "event Message(uint256 indexed id, address indexed from, address indexed to, string body, uint64 timestamp)",
);

export interface ContractMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: number;
  tx: string;
  block: string;
}

/** Calldata for SignaMessages.send(to, body) — the tx goes TO the contract. */
export function buildMessageCall(to: string, body: string): Hex {
  return encodeFunctionData({ abi: SEND_ABI, functionName: "send", args: [norm(to) as Address, body] });
}

/**
 * Wallet-agnostic transaction REQUEST that records a readable on-chain message via
 * the SignaMessages contract: `{ to: contract, value: "0x0", data, chainId }`. Feed
 * it to any wallet (injected `eth_sendTransaction` / WalletConnect). No website needed.
 */
export function composeMessage(a: { to: string; body: string; contract?: string }): {
  to: string;
  value: "0x0";
  data: Hex;
  chainId: string;
} {
  return {
    to: norm(a.contract ?? SIGNA_MESSAGES_ADDRESS),
    value: "0x0",
    data: buildMessageCall(a.to, a.body),
    chainId: BASE_CHAIN_ID_HEX,
  };
}

/** Broadcast a message through the SignaMessages contract from a local key. */
export async function sendContractMessage(
  privateKey: string,
  args: { to: string; body: string; contract?: string; rpcUrl?: string },
): Promise<{ hash: string; from: string; to: string; contract: string; explorer: string }> {
  if (!args.to || !/^0x[a-fA-F0-9]{40}$/.test(args.to)) {
    throw new Error(`sendContractMessage: invalid recipient "${args.to}"`);
  }
  if (!args.body || args.body.length === 0) throw new Error("sendContractMessage: body is required");
  const pk = (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as Hex;
  const account = privateKeyToAccount(pk);
  const contract = norm(args.contract ?? SIGNA_MESSAGES_ADDRESS);
  const wallet = createWalletClient({ account, chain: base, transport: http(args.rpcUrl ?? DEFAULT_RPC) });
  const hash = await wallet.sendTransaction({ to: contract as Hex, value: 0n, data: buildMessageCall(args.to, args.body) });
  return { hash, from: norm(account.address), to: norm(args.to), contract, explorer: `https://basescan.org/tx/${hash}` };
}

/**
 * Read messages straight from the SignaMessages contract's event logs (the chain
 * is the index). Filter by `to` (inbox) and/or `from` (outbox); newest first.
 */
export async function readContractMessages(
  args: { to?: string; from?: string; contract?: string; rpcUrl?: string; limit?: number } = {},
): Promise<ContractMessage[]> {
  const contract = norm(args.contract ?? SIGNA_MESSAGES_ADDRESS);
  const client = createPublicClient({ chain: base, transport: http(args.rpcUrl ?? DEFAULT_RPC) });
  const filter: Record<string, unknown> = {};
  if (args.to) filter.to = norm(args.to) as Address;
  if (args.from) filter.from = norm(args.from) as Address;
  const logs = await client.getLogs({
    address: contract as Address,
    event: MESSAGE_EVENT,
    args: filter,
    fromBlock: SIGNA_MESSAGES_DEPLOY_BLOCK,
    toBlock: "latest",
  });
  const out: ContractMessage[] = (logs as any[]).map((l) => ({
    id: String(l.args.id),
    from: norm(String(l.args.from)),
    to: norm(String(l.args.to)),
    body: String(l.args.body ?? ""),
    timestamp: Number(l.args.timestamp ?? 0),
    tx: l.transactionHash as string,
    block: String(l.blockNumber),
  }));
  out.sort((x, y) => Number(y.id) - Number(x.id));
  return out.slice(0, Math.min(Math.max(args.limit ?? 50, 1), 200));
}
