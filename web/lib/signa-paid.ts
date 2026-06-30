/**
 * SignaPaidMessages — pay-to-reach inboxes, settled on Base in the same tx.
 *
 * Set a price for your inbox; a sender attaches >= that value and it's forwarded
 * to you in full, in the same transaction that records a readable `PaidMessage`
 * event. SIGNA custodies nothing and takes no fee. The chain is the index —
 * inbox/feed/price are read straight from the contract.
 *
 * Deployed (Base mainnet): 0xe6e8999039ff02d3140daf6427abb55f33cd0501
 */
import { createPublicClient, http, parseAbiItem, encodeFunctionData, formatEther, type Address } from "viem";
import { base } from "viem/chains";

export const SIGNA_PAID_ADDRESS = (
  process.env.NEXT_PUBLIC_SIGNA_PAID_ADDRESS ||
  process.env.SIGNA_PAID_ADDRESS ||
  "0xe6e8999039ff02d3140daf6427abb55f33cd0501"
).toLowerCase();

export const SIGNA_PAID_DEPLOY_BLOCK = 48016380n; // tx 0x75793e…

export const PAID_MESSAGE_EVENT = parseAbiItem(
  "event PaidMessage(uint256 indexed id, address indexed from, address indexed to, uint256 value, string body, uint64 timestamp)",
);
const PAID_ABI = [
  parseAbiItem("function send(address to, string body) payable returns (uint256)"),
  parseAbiItem("function setPrice(uint256 weiPrice)"),
  parseAbiItem("function price(address) view returns (uint256)"),
] as const;

let _client: any = null;
function client(): any {
  if (!_client) _client = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL || "https://mainnet.base.org") });
  return _client;
}

export type PaidMessage = {
  id: string;
  from: string;
  to: string;
  value: string; // wei
  value_eth: string;
  body: string;
  timestamp: number;
  tx: string;
  block: string;
};

/** Calldata for SignaPaidMessages.send(to, body) — send with `value` attached. */
export function buildPaidSendCalldata(to: string, body: string): `0x${string}` {
  return encodeFunctionData({ abi: PAID_ABI, functionName: "send", args: [to.toLowerCase() as Address, body] });
}

/** Calldata for setPrice(weiPrice). */
export function buildSetPriceCalldata(weiPrice: bigint): `0x${string}` {
  return encodeFunctionData({ abi: PAID_ABI, functionName: "setPrice", args: [weiPrice] });
}

/** The price (in wei + ETH) to message a wallet. 0 = free. */
export async function priceOf(address: string): Promise<{ wei: string; eth: string }> {
  if (!/^0x[0-9a-f]{40}$/.test(address.toLowerCase())) return { wei: "0", eth: "0" };
  try {
    const wei: bigint = await client().readContract({ address: SIGNA_PAID_ADDRESS as Address, abi: PAID_ABI, functionName: "price", args: [address.toLowerCase() as Address] });
    return { wei: wei.toString(), eth: formatEther(wei) };
  } catch {
    return { wei: "0", eth: "0" };
  }
}

async function readPaidLogs(args: Record<string, unknown>, limit: number): Promise<PaidMessage[]> {
  const logs = await client().getLogs({
    address: SIGNA_PAID_ADDRESS as Address,
    event: PAID_MESSAGE_EVENT,
    args,
    fromBlock: SIGNA_PAID_DEPLOY_BLOCK,
    toBlock: "latest",
  });
  const out: PaidMessage[] = (logs as any[]).map((l) => ({
    id: String(l.args.id),
    from: String(l.args.from).toLowerCase(),
    to: String(l.args.to).toLowerCase(),
    value: String(l.args.value),
    value_eth: formatEther(BigInt(l.args.value ?? 0)),
    body: String(l.args.body ?? ""),
    timestamp: Number(l.args.timestamp ?? 0),
    tx: l.transactionHash as string,
    block: String(l.blockNumber),
  }));
  out.sort((a, b) => Number(b.id) - Number(a.id));
  return out.slice(0, Math.min(Math.max(limit, 1), 100));
}

/** Latest paid messages across the contract. */
export async function paidRecent(limit = 50): Promise<PaidMessage[]> {
  return readPaidLogs({}, limit);
}

/** Paid messages received by a wallet. */
export async function paidInbox(address: string, limit = 50): Promise<PaidMessage[]> {
  if (!/^0x[0-9a-f]{40}$/.test(address.toLowerCase())) return [];
  return readPaidLogs({ to: address.toLowerCase() as Address }, limit);
}
