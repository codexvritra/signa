/**
 * SIGNA canonical chain config — Robinhood Chain.
 *
 * Single source of truth for chain id / RPC / explorer / native payment asset,
 * used by every onchain lib in this app (rooms, capability registry, node
 * registry, paid messages, log anchor, x402, etc). Robinhood Chain is an
 * Arbitrum Orbit L2, ETH gas, chainId 4663 (verified via eth_chainId → 0x1237).
 *
 * Override via env for a future re-verified mainnet value or local testnet work.
 */
import { createPublicClient, defineChain, formatEther, formatGwei, http, type Address } from "viem";
import { mainnet } from "viem/chains";

export const RH_CHAIN_ID = Number(process.env.NEXT_PUBLIC_RH_CHAIN_ID || 4663);
export const RH_RPC = process.env.NEXT_PUBLIC_RH_RPC || "https://rpc.mainnet.chain.robinhood.com";
export const RH_EXPLORER = (process.env.NEXT_PUBLIC_RH_EXPLORER || "https://robinhoodchain.blockscout.com").replace(/\/$/, "");
export const RH_CHAIN_NAME = process.env.NEXT_PUBLIC_RH_CHAIN_NAME || "Robinhood Chain";
export const RH_CHAIN_ID_HEX = "0x" + RH_CHAIN_ID.toString(16);

/**
 * USDG (Global Dollar, Paxos) — Robinhood Chain's native stablecoin, not USDC.
 * Circle has never issued USDC on Robinhood Chain; every "USDC"-ticker contract
 * on the chain's explorer is an unofficial/impostor token (same squatting problem
 * SIGNA's own /rwa proof layer catches for stock tickers). Verified independently
 * via Paxos's own docs (docs.paxos.com/guides/stablecoin/usdg/mainnet) and on-chain
 * at Blockscout: "Global Dollar (USDG)", 6 decimals, linked to globaldollar.com.
 */
export const USDG_ADDRESS = (process.env.NEXT_PUBLIC_USDG_ADDRESS || "0x5fc5360d0400a0fd4f2af552add042d716f1d168").toLowerCase();
export const USDG_DECIMALS = 6;
export const USDG_SYMBOL = "USDG";

export const rhChain = defineChain({
  id: RH_CHAIN_ID,
  name: RH_CHAIN_NAME,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RH_RPC] } },
  blockExplorers: RH_EXPLORER ? { default: { name: "Explorer", url: RH_EXPLORER } } : undefined,
});

export function explorerTx(hash: string): string {
  return `${RH_EXPLORER}/tx/${hash}`;
}

export function explorerAddress(address: string): string {
  return `${RH_EXPLORER}/address/${address}`;
}

export function explorerToken(address: string): string {
  return `${RH_EXPLORER}/token/${address}`;
}

let _client: ReturnType<typeof createPublicClient> | null = null;
export function rhClient() {
  if (!_client) _client = createPublicClient({ chain: rhChain, transport: http(RH_RPC) });
  return _client;
}

// Mainnet client kept separate — used only for ENS reverse lookups (ENS lives on
// Ethereum mainnet; Robinhood Chain has no ENS deployment of its own).
export const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETHEREUM_RPC_URL),
});

export async function getEthBalance(address: Address) {
  const wei = await rhClient().getBalance({ address });
  return { wei: wei.toString(), eth: formatEther(wei) };
}

export async function getNonce(address: Address) {
  return rhClient().getTransactionCount({ address });
}

export async function getNetworkStatus() {
  const [block, gas] = await Promise.all([
    rhClient().getBlockNumber(),
    rhClient().getGasPrice(),
  ]);
  return {
    chain: "robinhood",
    chainId: RH_CHAIN_ID,
    blockNumber: block.toString(),
    gasPriceWei: gas.toString(),
    gasPriceGwei: formatGwei(gas),
  };
}

export async function getCode(address: Address) {
  const code = await rhClient().getCode({ address });
  return {
    isContract: !!code && code !== "0x",
    bytecodeLength: code ? (code.length - 2) / 2 : 0,
  };
}

export async function ensNameFor(address: Address) {
  try {
    const name = await mainnetClient.getEnsName({ address });
    return { address, name: name ?? null };
  } catch (e) {
    return { address, name: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function addressForEns(name: string) {
  try {
    const address = await mainnetClient.getEnsAddress({ name });
    return { name, address: address ?? null };
  } catch (e) {
    return { name, address: null, error: e instanceof Error ? e.message : String(e) };
  }
}
