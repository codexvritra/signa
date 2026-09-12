import { createPublicClient, defineChain, formatEther, formatGwei, http } from "viem";
import { mainnet } from "viem/chains";

// Robinhood Chain — Arbitrum Orbit L2, ETH gas, chainId 4663 (verified via eth_chainId).
const RH_RPC = process.env.ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
const RH_EXPLORER = process.env.ROBINHOOD_EXPLORER_URL || "https://robinhoodchain.blockscout.com";
const ethRpc = process.env.ETHEREUM_RPC_URL;

const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RH_RPC] } },
  blockExplorers: { default: { name: "Explorer", url: RH_EXPLORER } },
});

export const robinhoodClient = createPublicClient({
  chain: robinhoodChain,
  transport: http(RH_RPC),
});

// Mainnet client used for ENS lookups (ENS lives on Ethereum mainnet).
export const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(ethRpc),
});

export async function getEthBalance(address: `0x${string}`) {
  const wei = await robinhoodClient.getBalance({ address });
  return { wei: wei.toString(), eth: formatEther(wei) };
}

export async function getNonce(address: `0x${string}`) {
  return robinhoodClient.getTransactionCount({ address });
}

export async function getNetworkStatus() {
  const [block, gas] = await Promise.all([
    robinhoodClient.getBlockNumber(),
    robinhoodClient.getGasPrice(),
  ]);
  return {
    chain: "robinhood",
    chainId: robinhoodChain.id,
    blockNumber: block.toString(),
    gasPriceWei: gas.toString(),
    gasPriceGwei: formatGwei(gas),
  };
}

export async function getCode(address: `0x${string}`) {
  const code = await robinhoodClient.getCode({ address });
  return {
    isContract: !!code && code !== "0x",
    bytecodeLength: code ? (code.length - 2) / 2 : 0,
  };
}

export async function getTransaction(hash: `0x${string}`) {
  try {
    const tx = await robinhoodClient.getTransaction({ hash });
    let receipt: Awaited<ReturnType<typeof robinhoodClient.getTransactionReceipt>> | null = null;
    try {
      receipt = await robinhoodClient.getTransactionReceipt({ hash });
    } catch {
      // not yet mined
    }
    return {
      hash,
      from: tx.from,
      to: tx.to,
      valueWei: tx.value.toString(),
      valueEth: formatEther(tx.value),
      nonce: tx.nonce,
      blockNumber: tx.blockNumber?.toString() ?? null,
      status: receipt?.status ?? "pending",
      gasUsed: receipt?.gasUsed?.toString() ?? null,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function ensNameFor(address: `0x${string}`) {
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
