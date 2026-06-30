/**
 * SignaMessages — the on-chain message contract on Base.
 *
 * `send(to, body)` records a message as a `Message(id, from, to, body, ts)`
 * event. The chain IS the index: inbox/outbox/threads are read straight from
 * the contract's event logs (no database). Once the contract is verified on
 * Basescan the event renders as readable, decoded activity; either way our app
 * decodes it here with the ABI.
 *
 * Deployed (Base mainnet): 0x142770698171a8e76b6268963a5a531ec4b64ad9
 */
import { createPublicClient, http, parseAbiItem, encodeFunctionData, type Address } from "viem";
import { base } from "viem/chains";

export const SIGNA_MESSAGES_ADDRESS = (
  process.env.NEXT_PUBLIC_SIGNA_MESSAGES_ADDRESS ||
  process.env.SIGNA_MESSAGES_ADDRESS ||
  "0x142770698171a8e76b6268963a5a531ec4b64ad9"
).toLowerCase();

/** Block the contract was deployed at — bounds getLogs so reads stay cheap. */
export const SIGNA_MESSAGES_DEPLOY_BLOCK = 48007737n; // tx 0x98069e…, block 0x2dc8e39

export const MESSAGE_EVENT = parseAbiItem(
  "event Message(uint256 indexed id, address indexed from, address indexed to, string body, uint64 timestamp)",
);

const SEND_ABI = [parseAbiItem("function send(address to, string body) returns (uint256)")] as const;

// typed `any`: the monorepo resolves multiple viem copies (pinned client clashes)
let _client: any = null;
function client(): any {
  if (!_client) _client = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL || "https://mainnet.base.org") });
  return _client;
}

export type OnchainMessage = {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: number;
  tx: string;
  block: string;
};

/** Build the calldata for SignaMessages.send(to, body) — the tx goes to the contract. */
export function buildSendCalldata(to: string, body: string): `0x${string}` {
  return encodeFunctionData({ abi: SEND_ABI, functionName: "send", args: [to.toLowerCase() as Address, body] });
}

async function readLogs(args: Record<string, unknown>, limit: number): Promise<OnchainMessage[]> {
  if (!SIGNA_MESSAGES_ADDRESS || SIGNA_MESSAGES_ADDRESS === "0x") return [];
  const logs = await client().getLogs({
    address: SIGNA_MESSAGES_ADDRESS as Address,
    event: MESSAGE_EVENT,
    args,
    fromBlock: SIGNA_MESSAGES_DEPLOY_BLOCK,
    toBlock: "latest",
  });
  const out: OnchainMessage[] = (logs as any[]).map((l) => ({
    id: String(l.args.id),
    from: String(l.args.from).toLowerCase(),
    to: String(l.args.to).toLowerCase(),
    body: String(l.args.body ?? ""),
    timestamp: Number(l.args.timestamp ?? 0),
    tx: l.transactionHash as string,
    block: String(l.blockNumber),
  }));
  // newest first
  out.sort((a, b) => Number(b.id) - Number(a.id));
  return out.slice(0, Math.min(Math.max(limit, 1), 200));
}

/** The latest messages across the whole contract — the global onchain wall. */
export async function contractRecent(limit = 50): Promise<OnchainMessage[]> {
  return readLogs({}, limit);
}

/** Messages sent TO a wallet — read straight from the chain's event logs. */
export async function contractInbox(address: string, limit = 50): Promise<OnchainMessage[]> {
  if (!/^0x[0-9a-f]{40}$/.test(address.toLowerCase())) return [];
  return readLogs({ to: address.toLowerCase() as Address }, limit);
}

/** Messages a wallet SENT. */
export async function contractOutbox(address: string, limit = 50): Promise<OnchainMessage[]> {
  if (!/^0x[0-9a-f]{40}$/.test(address.toLowerCase())) return [];
  return readLogs({ from: address.toLowerCase() as Address }, limit);
}

/** Full conversation between two wallets, oldest first. */
export async function contractThread(a: string, b: string, limit = 200): Promise<OnchainMessage[]> {
  const al = a.toLowerCase(), bl = b.toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(al) || !/^0x[0-9a-f]{40}$/.test(bl)) return [];
  const [ab, ba] = await Promise.all([
    readLogs({ from: al as Address, to: bl as Address }, limit),
    readLogs({ from: bl as Address, to: al as Address }, limit),
  ]);
  return [...ab, ...ba].sort((x, y) => Number(x.id) - Number(y.id)).slice(-limit);
}
