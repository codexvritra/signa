/**
 * Pons launchpad indexer (Robinhood Chain mainnet).
 *
 * Pons (ponsfamily.com/launchpad) has no creation API — tokens are launched
 * through their own interface, wallet-to-wallet. What we CAN do is watch the
 * factory's public TokenLaunched event and mirror every launch onto our own
 * site, wired to a live SIGDA agent per token (see lib/launchpad.ts).
 *
 * We deliberately don't decode the event body beyond the token address: the
 * exact non-indexed arg layout differs between pons docs versions we found,
 * but `token` is the first indexed topic in every version — decoding just
 * that and reading the ERC20 itself directly is robust regardless.
 */
import { getAddress, numberToHex, type Address } from "viem";
import { rhClient } from "./chain";

export const PONS_FACTORY = "0xa5aab3f0c6eeadf30ef1d3eb997108e976351feb";
export const PONS_FACTORY_DEPLOY_BLOCK = 8991118n;
export const TOKEN_LAUNCHED_TOPIC0 = "0xdb51ea9ad51ab453a65a4cb7e60c3cb378c9501bb002609f8f97778fb6c4235a";

const ERC20_META = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

export type PonsLaunchLog = { token: string; block: bigint; tx: string; logIndex: number };

/** Raw TokenLaunched logs in [fromBlock, toBlock], newest last. Chunked to stay under RPC log-range limits. */
type RawLog = { topics: string[]; transactionHash: string; blockNumber: string; logIndex: string };

/**
 * Raw eth_getLogs via the transport directly (not viem's typed getLogs action,
 * which in this viem version only supports event/args-based filtering — we
 * deliberately filter by topic0 alone, see file header for why).
 */
export async function readPonsLaunchLogs(fromBlock: bigint, toBlock: bigint, chunk = 500n): Promise<PonsLaunchLog[]> {
  const client = rhClient();
  const out: PonsLaunchLog[] = [];
  for (let start = fromBlock; start <= toBlock; start += chunk + 1n) {
    const end = start + chunk > toBlock ? toBlock : start + chunk;
    const logs = (await client.request({
      method: "eth_getLogs",
      params: [{
        address: PONS_FACTORY as Address,
        topics: [TOKEN_LAUNCHED_TOPIC0 as `0x${string}`],
        fromBlock: numberToHex(start),
        toBlock: numberToHex(end),
      }],
    } as any)) as RawLog[];
    for (const l of logs) {
      const t1 = l.topics?.[1];
      if (!t1) continue;
      try {
        out.push({ token: getAddress(`0x${t1.slice(26)}`).toLowerCase(), block: BigInt(l.blockNumber ?? "0x0"), tx: l.transactionHash ?? "", logIndex: parseInt(l.logIndex ?? "0x0", 16) });
      } catch { /* skip malformed topic */ }
    }
  }
  return out;
}

export type TokenMeta = { name: string; symbol: string; decimals: number; totalSupply: string };

/** Best-effort ERC20 metadata read — never throws, falls back to short address as name/symbol. */
export async function tokenMeta(token: string): Promise<TokenMeta> {
  const client = rhClient();
  const addr = token as Address;
  const short = `${token.slice(0, 6)}…${token.slice(-4)}`;
  const [name, symbol, decimals, totalSupply] = await Promise.all([
    client.readContract({ address: addr, abi: ERC20_META, functionName: "name" }).catch(() => short),
    client.readContract({ address: addr, abi: ERC20_META, functionName: "symbol" }).catch(() => short.toUpperCase()),
    client.readContract({ address: addr, abi: ERC20_META, functionName: "decimals" }).catch(() => 18),
    client.readContract({ address: addr, abi: ERC20_META, functionName: "totalSupply" }).catch(() => 0n),
  ]);
  return { name: String(name), symbol: String(symbol), decimals: Number(decimals), totalSupply: String(totalSupply) };
}
