import type { DecodedMessage } from "@xmtp/browser-sdk";

export type NormalizedContent = {
  /** Plain-text content. Empty for non-text content types. */
  text: string;
  /** For reply messages, the referenced original message. */
  replyTo: DecodedMessage | null;
  isReply: boolean;
  /** True if this is a transaction reference (payment receipt) message. */
  isTransactionRef: boolean;
  /** For transaction-reference messages, the raw content shape. */
  transactionRef:
    | {
        namespace?: string;
        networkId?: string;
        reference?: string;
        metadata?: {
          transactionType?: string;
          currency?: string;
          amount?: number;
          decimals?: number;
          fromAddress?: string;
          toAddress?: string;
        };
      }
    | null;
};

function looksLikeTxRef(content: unknown): boolean {
  if (!content || typeof content !== "object") return false;
  const c = content as Record<string, unknown>;
  return (
    typeof c.reference === "string" &&
    typeof c.networkId === "string"
  );
}

export function normalizeMessageContent(message: DecodedMessage): NormalizedContent {
  const content = message.content;

  // Plain text
  if (typeof content === "string") {
    return {
      text: content,
      replyTo: null,
      isReply: false,
      isTransactionRef: false,
      transactionRef: null,
    };
  }

  // Reply (EnrichedReply)
  if (
    content &&
    typeof content === "object" &&
    "referenceId" in (content as Record<string, unknown>)
  ) {
    const enriched = content as unknown as {
      content: unknown;
      inReplyTo: DecodedMessage | null;
    };
    const inner =
      typeof enriched.content === "string" ? enriched.content : "";
    return {
      text: inner,
      replyTo: enriched.inReplyTo ?? null,
      isReply: true,
      isTransactionRef: false,
      transactionRef: null,
    };
  }

  // Transaction reference (payment receipt)
  if (looksLikeTxRef(content)) {
    return {
      text: "",
      replyTo: null,
      isReply: false,
      isTransactionRef: true,
      transactionRef: content as NormalizedContent["transactionRef"],
    };
  }

  return {
    text: "",
    replyTo: null,
    isReply: false,
    isTransactionRef: false,
    transactionRef: null,
  };
}

export function getMessageText(message: DecodedMessage): string {
  const n = normalizeMessageContent(message);
  if (n.text) return n.text;
  if (n.isTransactionRef) {
    const md = n.transactionRef?.metadata;
    const amt = md?.amount;
    const dec = md?.decimals ?? 18;
    if (typeof amt === "number") {
      const eth = (amt / Math.pow(10, dec)).toString();
      return `Payment · ${eth} ${md?.currency ?? "ETH"}`;
    }
    return "Payment";
  }
  return "";
}
