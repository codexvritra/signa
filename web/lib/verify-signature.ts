import { verifyMessage, type Address, type Hex } from "viem";
import { SIG_MAX_AGE_MS } from "./feed-types";

export type VerifyResult =
  | { ok: true; address: Address }
  | { ok: false; reason: string };

/**
 * Verify a wallet signature over a canonical signed message. Accepts both
 * EOA and EIP-1271 (smart-account) signatures via viem.verifyMessage.
 *
 * Also enforces a max age on the signed timestamp so old signatures can't
 * be replayed forever.
 */
export async function verifySignedMessage(args: {
  expectedAddress: string;
  message: string;
  signature: string;
  ts: number;
}): Promise<VerifyResult> {
  const { expectedAddress, message, signature, ts } = args;

  if (!/^0x[a-fA-F0-9]{40}$/.test(expectedAddress)) {
    return { ok: false, reason: "Invalid address shape" };
  }
  if (!signature || !signature.startsWith("0x") || signature.length < 100) {
    return { ok: false, reason: "Invalid signature shape" };
  }
  if (!Number.isFinite(ts)) {
    return { ok: false, reason: "Invalid timestamp" };
  }
  const age = Date.now() - ts;
  if (age < -60_000 || age > SIG_MAX_AGE_MS) {
    return { ok: false, reason: "Signature timestamp out of window" };
  }

  try {
    let ok = await verifyMessage({
      address: expectedAddress.toLowerCase() as Address,
      message,
      signature: signature as Hex,
    });
    // Pre-rebrand compatibility: canonical messages are branded "SIGDA"
    // throughout (was "SIGDA" before the rebrand) — some also repeat the
    // brand name in signing-prompt prose, not just the leading marker. A
    // client on an old cached build (or a signature made before the rebrand
    // shipped) still signs the all-legacy text — retry against the
    // word-for-word legacy reconstruction before failing, so nothing
    // already signed silently breaks.
    if (!ok && /\bSIGDA\b/.test(message)) {
      const legacyMessage = message.replace(/\bSIGDA\b/g, "SIGDA");
      ok = await verifyMessage({
        address: expectedAddress.toLowerCase() as Address,
        message: legacyMessage,
        signature: signature as Hex,
      });
    }
    if (!ok) return { ok: false, reason: "Signature does not match address" };
    return { ok: true, address: expectedAddress.toLowerCase() as Address };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Parse @mentions in a post body. Currently supports plain addresses
 * (0x40hex), Basenames (name.base.eth), and ENS (name.eth). Returns an
 * array of lowercased addresses — names are resolved server-side against
 * the `users` table by the caller.
 */
export function extractMentions(content: string): {
  rawTokens: string[];
} {
  const matches = content.match(/@([a-z0-9_\-.]+(?:\.eth)?)|@(0x[a-fA-F0-9]{40})/gi) ?? [];
  const tokens = matches.map((m) => m.slice(1)); // strip leading @
  return { rawTokens: Array.from(new Set(tokens.map((t) => t.toLowerCase()))) };
}
