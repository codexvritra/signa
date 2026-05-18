import type { DecodedMessage } from "@xmtp/browser-sdk";

/**
 * For an XMTP "reply" content-type message, the content is an EnrichedReply
 * object with a text payload and a reference to the original message.
 * For text messages, content is just a string.
 *
 * This normalizes both into { text, replyTo } so the bubble can render
 * them uniformly.
 */
export type NormalizedContent = {
  text: string;
  replyTo: DecodedMessage | null;
  isReply: boolean;
};

export function normalizeMessageContent(message: DecodedMessage): NormalizedContent {
  const content = message.content;

  // Plain text
  if (typeof content === "string") {
    return { text: content, replyTo: null, isReply: false };
  }

  // Reply content type — EnrichedReply has .content (string) and .inReplyTo (DecodedMessage|null)
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
    };
  }

  return { text: "", replyTo: null, isReply: false };
}

export function getMessageText(message: DecodedMessage): string {
  return normalizeMessageContent(message).text;
}
