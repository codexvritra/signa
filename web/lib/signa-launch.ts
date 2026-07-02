/**
 * SignaLaunch — verifiable token launchpad on Robinhood Chain.
 *
 * A non-custodial factory: `launch(name, symbol, supply)` deploys a fixed-supply
 * ERC-20 and mints the full supply to the launcher (SIGNA holds nothing). Each
 * launch is a `Launched` event — provable "who launched what" — plus an optional
 * SIGNA wallet-signed launch receipt (verify kind `token_launch`). The launcher
 * adds liquidity on the chain's DEX (Uniswap is live on Robinhood Chain).
 *
 * Chain is env-configured. Verified TESTNET params below; set mainnet params in
 * env once confirmed at docs.robinhood.com/chain.
 */
import { createPublicClient, http, parseAbiItem, encodeFunctionData, defineChain, type Address } from "viem";

// Robinhood Chain — Arbitrum Orbit L2, ETH gas. Testnet params are verified;
// override via env for mainnet (NEXT_PUBLIC_RH_CHAIN_ID / _RPC / _EXPLORER).
// Robinhood Chain MAINNET (verified from the chain: eth_chainId → 0x1237 = 4663).
// The non-custodial SignaLaunch factory is safe to run on mainnet.
export const RH_CHAIN_ID = Number(process.env.NEXT_PUBLIC_RH_CHAIN_ID || 4663);
export const RH_RPC = process.env.NEXT_PUBLIC_RH_RPC || "https://rpc.mainnet.chain.robinhood.com";
export const RH_EXPLORER = (process.env.NEXT_PUBLIC_RH_EXPLORER || "https://robinhoodchain.blockscout.com").replace(/\/$/, "");
export const RH_CHAIN_NAME = process.env.NEXT_PUBLIC_RH_CHAIN_NAME || "Robinhood Chain";
export const RH_CHAIN_ID_HEX = "0x" + RH_CHAIN_ID.toString(16);

/** SignaLaunch factory address on Robinhood Chain — set after deploy. Empty = not deployed yet. */
export const SIGNA_LAUNCH_ADDRESS = (process.env.NEXT_PUBLIC_SIGNA_LAUNCH_ADDRESS || process.env.SIGNA_LAUNCH_ADDRESS || "").toLowerCase();
export const SIGNA_LAUNCH_DEPLOY_BLOCK = BigInt(process.env.SIGNA_LAUNCH_DEPLOY_BLOCK || 0);
export const launchpadLive = /^0x[0-9a-f]{40}$/.test(SIGNA_LAUNCH_ADDRESS);

export const rhChain = defineChain({
  id: RH_CHAIN_ID,
  name: RH_CHAIN_NAME,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RH_RPC] } },
  blockExplorers: RH_EXPLORER ? { default: { name: "Explorer", url: RH_EXPLORER } } : undefined,
});

const LAUNCHED = parseAbiItem("event Launched(address indexed token, address indexed launcher, string name, string symbol, uint256 supply, uint64 timestamp)");
const LAUNCH_ABI = [parseAbiItem("function launch(string name, string symbol, uint256 supplyWhole) returns (address)")] as const;

export function buildLaunchCalldata(name: string, symbol: string, supplyWhole: bigint): `0x${string}` {
  return encodeFunctionData({ abi: LAUNCH_ABI, functionName: "launch", args: [name, symbol, supplyWhole] });
}

export function explorerTx(hash: string): string { return RH_EXPLORER ? `${RH_EXPLORER}/tx/${hash}` : ""; }
export function explorerToken(addr: string): string { return RH_EXPLORER ? `${RH_EXPLORER}/token/${addr}` : (RH_EXPLORER ? `${RH_EXPLORER}/address/${addr}` : ""); }

export type Launch = { token: string; launcher: string; name: string; symbol: string; supply: string; timestamp: number; tx: string; block: string };

let _client: any = null;
function client(): any {
  if (!_client) _client = createPublicClient({ chain: rhChain, transport: http(RH_RPC) });
  return _client;
}

/** Recent launches, newest first — read from the factory's Launched events. */
export async function listLaunches(limit = 60): Promise<Launch[]> {
  if (!launchpadLive) return [];
  try {
    const logs = await client().getLogs({ address: SIGNA_LAUNCH_ADDRESS as Address, event: LAUNCHED, fromBlock: SIGNA_LAUNCH_DEPLOY_BLOCK, toBlock: "latest" });
    const out: Launch[] = (logs as any[]).map((l) => ({
      token: String(l.args.token).toLowerCase(),
      launcher: String(l.args.launcher).toLowerCase(),
      name: String(l.args.name ?? ""),
      symbol: String(l.args.symbol ?? ""),
      supply: String(l.args.supply ?? 0),
      timestamp: Number(l.args.timestamp ?? 0),
      tx: l.transactionHash as string,
      block: String(l.blockNumber),
    }));
    out.sort((a, b) => Number(b.block) - Number(a.block));
    return out.slice(0, Math.min(Math.max(limit, 1), 200));
  } catch {
    return [];
  }
}

/** Canonical SIGNA launch-receipt preimage (verify kind `token_launch`). */
export function launchReceiptPreimage(a: { ts: number; launcher: string; token: string; name: string; symbol: string; supply: string; chain: number }): string {
  return [
    "SIGNA token launch v1",
    `ts:${a.ts}`,
    `launcher:${a.launcher.toLowerCase()}`,
    `token:${a.token.toLowerCase()}`,
    `name:${a.name}`,
    `symbol:${a.symbol}`,
    `supply:${a.supply}`,
    `chain:${a.chain}`,
  ].join("\n");
}
