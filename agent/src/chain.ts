import { createPublicClient, formatEther, formatGwei, http } from "viem";
import { baseSepolia, mainnet } from "viem/chains";

const baseRpc = process.env.BASE_SEPOLIA_RPC_URL;
const ethRpc = process.env.ETHEREUM_RPC_URL;

export const baseSepoliaClient = createPublicClient({
  chain: baseSepolia,
  transport: http(baseRpc),
});

// Mainnet client used for ENS lookups only (ENS lives on Ethereum mainnet).
export const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(ethRpc),
});

export async function getEthBalance(address: `0x${string}`) {
  const wei = await baseSepoliaClient.getBalance({ address });
  return { wei: wei.toString(), eth: formatEther(wei) };
}

export async function getNonce(address: `0x${string}`) {
  return baseSepoliaClient.getTransactionCount({ address });
}

export async function getNetworkStatus() {
  const [block, gas] = await Promise.all([
    baseSepoliaClient.getBlockNumber(),
    baseSepoliaClient.getGasPrice(),
  ]);
  return {
    chain: "base-sepolia",
    chainId: baseSepolia.id,
    blockNumber: block.toString(),
    gasPriceWei: gas.toString(),
    gasPriceGwei: formatGwei(gas),
  };
}

export async function getCode(address: `0x${string}`) {
  const code = await baseSepoliaClient.getCode({ address });
  return {
    isContract: !!code && code !== "0x",
    bytecodeLength: code ? (code.length - 2) / 2 : 0,
  };
}

export async function getTransaction(hash: `0x${string}`) {
  try {
    const tx = await baseSepoliaClient.getTransaction({ hash });
    let receipt: Awaited<ReturnType<typeof baseSepoliaClient.getTransactionReceipt>> | null = null;
    try {
      receipt = await baseSepoliaClient.getTransactionReceipt({ hash });
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
