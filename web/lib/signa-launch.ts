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
import { parseAbiItem, encodeFunctionData, type Address } from "viem";
import { rhClient, RH_EXPLORER } from "./chain";

export { RH_CHAIN_ID, RH_RPC, RH_EXPLORER, RH_CHAIN_NAME, RH_CHAIN_ID_HEX, rhChain } from "./chain";

/** SignaLaunch factory address on Robinhood Chain — set after deploy. Empty = not deployed yet. */
export const SIGNA_LAUNCH_ADDRESS = (process.env.NEXT_PUBLIC_SIGNA_LAUNCH_ADDRESS || process.env.SIGNA_LAUNCH_ADDRESS || "").toLowerCase();
export const SIGNA_LAUNCH_DEPLOY_BLOCK = BigInt(process.env.SIGNA_LAUNCH_DEPLOY_BLOCK || 0);
export const launchpadLive = /^0x[0-9a-f]{40}$/.test(SIGNA_LAUNCH_ADDRESS);

const LAUNCHED = parseAbiItem("event Launched(address indexed token, address indexed launcher, string name, string symbol, uint256 supply, uint64 timestamp)");
const LAUNCH_ABI = [parseAbiItem("function launch(string name, string symbol, uint256 supplyWhole) returns (address)")] as const;

export function buildLaunchCalldata(name: string, symbol: string, supplyWhole: bigint): `0x${string}` {
  return encodeFunctionData({ abi: LAUNCH_ABI, functionName: "launch", args: [name, symbol, supplyWhole] });
}

export function explorerTx(hash: string): string { return RH_EXPLORER ? `${RH_EXPLORER}/tx/${hash}` : ""; }
export function explorerToken(addr: string): string { return RH_EXPLORER ? `${RH_EXPLORER}/token/${addr}` : (RH_EXPLORER ? `${RH_EXPLORER}/address/${addr}` : ""); }

export type Launch = { token: string; launcher: string; name: string; symbol: string; supply: string; timestamp: number; tx: string; block: string };

/** Recent launches, newest first — read from the factory's Launched events. */
export async function listLaunches(limit = 60): Promise<Launch[]> {
  if (!launchpadLive) return [];
  try {
    const logs = await rhClient().getLogs({ address: SIGNA_LAUNCH_ADDRESS as Address, event: LAUNCHED, fromBlock: SIGNA_LAUNCH_DEPLOY_BLOCK, toBlock: "latest" });
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
