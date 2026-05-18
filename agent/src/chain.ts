import { createPublicClient, formatEther, formatGwei, http } from "viem";
import { base, mainnet } from "viem/chains";

const baseRpc = process.env.BASE_RPC_URL;
const ethRpc = process.env.ETHEREUM_RPC_URL;

export const baseClient = createPublicClient({
  chain: base,
  transport: http(baseRpc),
});

// Mainnet client used for ENS lookups (ENS lives on Ethereum mainnet).
export const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(ethRpc),
});

export async function getEthBalance(address: `0x${string}`) {
  const wei = await baseClient.getBalance({ address });
  return { wei: wei.toString(), eth: formatEther(wei) };
}

export async function getNonce(address: `0x${string}`) {
  return baseClient.getTransactionCount({ address });
}

export async function getNetworkStatus() {
  const [block, gas] = await Promise.all([
    baseClient.getBlockNumber(),
    baseClient.getGasPrice(),
  ]);
  return {
    chain: "base",
    chainId: base.id,
    blockNumber: block.toString(),
    gasPriceWei: gas.toString(),
    gasPriceGwei: formatGwei(gas),
  };
}

export async function getCode(address: `0x${string}`) {
  const code = await baseClient.getCode({ address });
  return {
    isContract: !!code && code !== "0x",
    bytecodeLength: code ? (code.length - 2) / 2 : 0,
  };
}

export async function getTransaction(hash: `0x${string}`) {
  try {
    const tx = await baseClient.getTransaction({ hash });
    let receipt: Awaited<ReturnType<typeof baseClient.getTransactionReceipt>> | null = null;
    try {
      receipt = await baseClient.getTransactionReceipt({ hash });
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
