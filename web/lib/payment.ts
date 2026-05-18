import { parseEther, type Address, type Hex } from "viem";
import type { Conversation } from "@xmtp/browser-sdk";
import { base } from "wagmi/chains";

export const PAYMENT_CHAIN_ID = base.id; // 8453 — Base mainnet
export const PAYMENT_NAMESPACE = "eip155";

export function parseEthAmount(input: string): bigint | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  try {
    return parseEther(trimmed);
  } catch {
    return null;
  }
}

/**
 * After a user has successfully sent an ETH transfer on Base mainnet,
 * publish a TransactionReference XMTP message so the tx appears as a
 * native payment card in the conversation.
 */
export async function shareTransactionReference(
  conv: Conversation,
  args: {
    txHash: Hex;
    fromAddress: Address;
    toAddress: Address;
    amountWei: bigint;
  },
) {
  const convAny = conv as unknown as {
    sendTransactionReference: (
      ref: {
        namespace?: string;
        networkId: string;
        reference: string;
        metadata?: {
          transactionType: string;
          currency: string;
          amount: number;
          decimals: number;
          fromAddress: string;
          toAddress: string;
        };
      },
    ) => Promise<string>;
  };

  // amount sent as raw wei numeric (with decimals=18 to scale).
  const amountNumber = Number(args.amountWei);

  return convAny.sendTransactionReference({
    namespace: PAYMENT_NAMESPACE,
    networkId: String(PAYMENT_CHAIN_ID),
    reference: args.txHash,
    metadata: {
      transactionType: "transfer",
      currency: "ETH",
      amount: Number.isFinite(amountNumber) ? amountNumber : 0,
      decimals: 18,
      fromAddress: args.fromAddress.toLowerCase(),
      toAddress: args.toAddress.toLowerCase(),
    },
  });
}

export function weiToEthString(wei: bigint | number, decimals = 18): string {
  const n = typeof wei === "bigint" ? wei : BigInt(Math.trunc(wei));
  const base = 10n ** BigInt(decimals);
  const whole = n / base;
  const frac = n % base;
  if (frac === 0n) return `${whole}`;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}
