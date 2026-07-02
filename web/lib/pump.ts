/**
 * SignaPump — bonding-curve launchpad client lib (Robinhood Chain).
 *
 * Reuses the RH chain config from signa-launch.ts. Address via env
 * (NEXT_PUBLIC_SIGNA_PUMP_ADDRESS) — empty until the pump is deployed.
 * ⚠️ Custodial contract — testnet only until audited.
 */
import { createPublicClient, http, parseAbiItem, encodeFunctionData, formatEther, type Address } from "viem";
import { rhChain, RH_RPC, RH_EXPLORER, RH_CHAIN_ID } from "./signa-launch";

export const SIGNA_PUMP_ADDRESS = (process.env.NEXT_PUBLIC_SIGNA_PUMP_ADDRESS || process.env.SIGNA_PUMP_ADDRESS || "").toLowerCase();
export const SIGNA_PUMP_DEPLOY_BLOCK = BigInt(process.env.SIGNA_PUMP_DEPLOY_BLOCK || 0);
export const pumpLive = /^0x[0-9a-f]{40}$/.test(SIGNA_PUMP_ADDRESS);
export { RH_EXPLORER, RH_CHAIN_ID } from "./signa-launch";

export const LAUNCHED_EVENT = parseAbiItem("event Launched(address indexed token, address indexed creator, string name, string symbol, uint64 timestamp)");
export const TRADE_EVENT = parseAbiItem("event Trade(address indexed token, address indexed trader, bool isBuy, uint256 ethAmount, uint256 tokenAmount, uint256 priceE18, uint64 timestamp)");
export const GRADUATED_EVENT = parseAbiItem("event Graduated(address indexed token, uint256 ethToDex, uint256 tokensToDex, uint64 timestamp)");
const PUMP_ABI = [
  parseAbiItem("function launch(string name, string symbol) payable returns (address)"),
  parseAbiItem("function buy(address token, uint256 minTokensOut) payable"),
  parseAbiItem("function sell(address token, uint256 tokensIn, uint256 minEthOut)"),
  parseAbiItem("function launchFeeWei() view returns (uint256)"),
  parseAbiItem("function progress(address token) view returns (uint256 raised, uint256 threshold, bool graduated)"),
  parseAbiItem("function priceOf(address token) view returns (uint256)"),
] as const;

let _client: any = null;
function client(): any {
  if (!_client) _client = createPublicClient({ chain: rhChain, transport: http(RH_RPC) });
  return _client;
}

export function buildLaunchCalldata(name: string, symbol: string): `0x${string}` {
  return encodeFunctionData({ abi: PUMP_ABI, functionName: "launch", args: [name, symbol] });
}
export function buildBuyCalldata(token: string, minTokensOut: bigint): `0x${string}` {
  return encodeFunctionData({ abi: PUMP_ABI, functionName: "buy", args: [token as Address, minTokensOut] });
}
export function buildSellCalldata(token: string, tokensIn: bigint, minEthOut: bigint): `0x${string}` {
  return encodeFunctionData({ abi: PUMP_ABI, functionName: "sell", args: [token as Address, tokensIn, minEthOut] });
}
const ERC20 = [
  parseAbiItem("function approve(address spender, uint256 value) returns (bool)"),
  parseAbiItem("function balanceOf(address owner) view returns (uint256)"),
] as const;
/** approve(pump, amount) on the token — needed before selling (transferFrom). */
export function buildApproveCalldata(spender: string, amount: bigint): `0x${string}` {
  return encodeFunctionData({ abi: ERC20, functionName: "approve", args: [spender as Address, amount] });
}
/** balanceOf(owner) calldata — for a client-side eth_call to a token. */
export function buildBalanceOfCalldata(owner: string): `0x${string}` {
  return encodeFunctionData({ abi: ERC20, functionName: "balanceOf", args: [owner as Address] });
}

/** Resolve the launched token + creator from a launch tx receipt (verifies it's a real SignaPump launch). */
export async function tokenFromReceipt(txHash: string): Promise<{ token: string; creator: string; name: string; symbol: string } | null> {
  if (!pumpLive || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) return null;
  try {
    const logs = await client().getContractEvents({ address: SIGNA_PUMP_ADDRESS as Address, abi: [LAUNCHED_EVENT], eventName: "Launched", fromBlock: SIGNA_PUMP_DEPLOY_BLOCK, toBlock: "latest" });
    const l = (logs as any[]).find((x) => (x.transactionHash as string).toLowerCase() === txHash.toLowerCase());
    if (!l) return null;
    return { token: String(l.args.token).toLowerCase(), creator: String(l.args.creator).toLowerCase(), name: String(l.args.name ?? ""), symbol: String(l.args.symbol ?? "") };
  } catch { return null; }
}

export async function launchFeeWei(): Promise<string> {
  if (!pumpLive) return "0";
  try { return String(await client().readContract({ address: SIGNA_PUMP_ADDRESS as Address, abi: PUMP_ABI, functionName: "launchFeeWei" })); } catch { return "0"; }
}

export type ChainLaunch = { token: string; creator: string; name: string; symbol: string; timestamp: number; tx: string; block: string };
export async function readLaunches(limit = 100): Promise<ChainLaunch[]> {
  if (!pumpLive) return [];
  try {
    const logs = await client().getContractEvents({ address: SIGNA_PUMP_ADDRESS as Address, abi: [LAUNCHED_EVENT], eventName: "Launched", fromBlock: SIGNA_PUMP_DEPLOY_BLOCK, toBlock: "latest" });
    const out: ChainLaunch[] = (logs as any[]).map((l) => ({
      token: String(l.args.token).toLowerCase(), creator: String(l.args.creator).toLowerCase(),
      name: String(l.args.name ?? ""), symbol: String(l.args.symbol ?? ""),
      timestamp: Number(l.args.timestamp ?? 0), tx: l.transactionHash as string, block: String(l.blockNumber),
    }));
    out.sort((a, b) => Number(b.block) - Number(a.block));
    return out.slice(0, limit);
  } catch { return []; }
}

/** Curve progress (raised/threshold/graduated) + spot price for a token. */
export async function tokenChainState(token: string): Promise<{ raised: string; threshold: string; graduated: boolean; priceE18: string } | null> {
  if (!pumpLive || !/^0x[0-9a-f]{40}$/.test(token.toLowerCase())) return null;
  try {
    const [p, price] = await Promise.all([
      client().readContract({ address: SIGNA_PUMP_ADDRESS as Address, abi: PUMP_ABI, functionName: "progress", args: [token.toLowerCase() as Address] }),
      client().readContract({ address: SIGNA_PUMP_ADDRESS as Address, abi: PUMP_ABI, functionName: "priceOf", args: [token.toLowerCase() as Address] }),
    ]);
    return { raised: String(p[0]), threshold: String(p[1]), graduated: Boolean(p[2]), priceE18: String(price) };
  } catch { return null; }
}

/** Trades for a token (for the candlestick chart), oldest first. */
export type PumpTrade = { isBuy: boolean; eth: string; tokens: string; priceE18: string; timestamp: number; tx: string };
export async function tokenTrades(token: string, limit = 500): Promise<PumpTrade[]> {
  if (!pumpLive) return [];
  try {
    const logs = await client().getContractEvents({ address: SIGNA_PUMP_ADDRESS as Address, abi: [TRADE_EVENT], eventName: "Trade", args: { token: token.toLowerCase() as Address }, fromBlock: SIGNA_PUMP_DEPLOY_BLOCK, toBlock: "latest" });
    const out: PumpTrade[] = (logs as any[]).map((l) => ({
      isBuy: Boolean(l.args.isBuy), eth: String(l.args.ethAmount), tokens: String(l.args.tokenAmount),
      priceE18: String(l.args.priceE18), timestamp: Number(l.args.timestamp ?? 0), tx: l.transactionHash as string,
    }));
    out.sort((a, b) => a.timestamp - b.timestamp);
    return out.slice(-limit);
  } catch { return []; }
}

export const fmtEth = (wei: string) => { try { return formatEther(BigInt(wei)); } catch { return "0"; } };

export type Activity = { kind: "buy" | "sell" | "launch" | "graduate"; token: string; actor: string; eth: string; ts: number; tx: string; block: number };

/** Recent activity across the whole launchpad — buys, sells, launches, graduations. Newest first. */
export async function pumpActivity(limit = 40): Promise<Activity[]> {
  if (!pumpLive) return [];
  try {
    const [trades, launches, grads] = await Promise.all([
      client().getContractEvents({ address: SIGNA_PUMP_ADDRESS as Address, abi: [TRADE_EVENT], eventName: "Trade", fromBlock: SIGNA_PUMP_DEPLOY_BLOCK, toBlock: "latest" }),
      client().getContractEvents({ address: SIGNA_PUMP_ADDRESS as Address, abi: [LAUNCHED_EVENT], eventName: "Launched", fromBlock: SIGNA_PUMP_DEPLOY_BLOCK, toBlock: "latest" }),
      client().getContractEvents({ address: SIGNA_PUMP_ADDRESS as Address, abi: [GRADUATED_EVENT], eventName: "Graduated", fromBlock: SIGNA_PUMP_DEPLOY_BLOCK, toBlock: "latest" }),
    ]);
    const items: Activity[] = [];
    for (const l of trades as any[]) items.push({ kind: l.args.isBuy ? "buy" : "sell", token: String(l.args.token).toLowerCase(), actor: String(l.args.trader).toLowerCase(), eth: String(l.args.ethAmount), ts: Number(l.args.timestamp ?? 0), tx: l.transactionHash, block: Number(l.blockNumber) });
    for (const l of launches as any[]) items.push({ kind: "launch", token: String(l.args.token).toLowerCase(), actor: String(l.args.creator).toLowerCase(), eth: "0", ts: Number(l.args.timestamp ?? 0), tx: l.transactionHash, block: Number(l.blockNumber) });
    for (const l of grads as any[]) items.push({ kind: "graduate", token: String(l.args.token).toLowerCase(), actor: "", eth: String(l.args.ethToDex ?? 0), ts: Number(l.args.timestamp ?? 0), tx: l.transactionHash, block: Number(l.blockNumber) });
    items.sort((a, b) => b.block - a.block);
    return items.slice(0, Math.min(Math.max(limit, 1), 100));
  } catch { return []; }
}
