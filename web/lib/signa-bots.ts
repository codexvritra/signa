/**
 * SIGNA bot accounts — wallet-signed feed publishers for ecosystem bridges.
 *
 * Each bridge (MiroShark webhook receiver, gitlawb poller, Bankr chain
 * listener) has its own bot wallet that signs every post it publishes.
 * The signature on each post is verifiable proof that the bridge — not a
 * random spammer — wrote it. Posts show up in the standard SIGNA feed
 * with the bot's basename (e.g. `miroshark.bot.signa`).
 *
 * Setup: visit /admin/generate-bot-keys once, copy the printed private
 * keys into Vercel env (`MIROSHARK_BOT_KEY`, `GITLAWB_BOT_KEY`,
 * `BANKR_BOT_KEY`). The bridges auto-register their bot wallet in the
 * users table on first post.
 */

import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import { serverClient } from "./supabase";
import { buildMessageToSign, MAX_POST_LENGTH } from "./feed-types";

export type BotKind = "miroshark" | "gitlawb" | "bankr";

const BOT_BASENAMES: Record<BotKind, string> = {
  miroshark: "miroshark.bot.signa",
  gitlawb: "gitlawb.bot.signa",
  bankr: "bankr.bot.signa",
};

const BOT_ENV_KEYS: Record<BotKind, string> = {
  miroshark: "MIROSHARK_BOT_KEY",
  gitlawb: "GITLAWB_BOT_KEY",
  bankr: "BANKR_BOT_KEY",
};

/** Returns null if the bot's private key isn't configured. */
export function getBotAccount(kind: BotKind) {
  const envKey = BOT_ENV_KEYS[kind];
  const raw = process.env[envKey];
  if (!raw) return null;
  const key = raw.startsWith("0x") ? raw : `0x${raw}`;
  if (!/^0x[a-fA-F0-9]{64}$/.test(key)) {
    throw new Error(
      `${envKey} is set but malformed — expected 0x-prefixed 64-hex-char private key`,
    );
  }
  return privateKeyToAccount(key as Hex);
}

/** Best-effort idempotent registration of the bot in the users table. */
async function ensureRegistered(kind: BotKind, address: string) {
  const db = serverClient();
  const basename = BOT_BASENAMES[kind];

  // Upsert. Schema: users(address PK, basename, ens_name, registered_at, updated_at)
  const { error } = await db.from("users").upsert(
    {
      address: address.toLowerCase(),
      basename,
      ens_name: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "address" },
  );
  if (error) {
    // Don't throw — registration is best-effort. The post insert below
    // will fail with a clearer error if the user isn't actually present.
    console.error(`[signa-bots] register ${kind} failed:`, error.message);
  }
}

/**
 * Publish a wallet-signed post to the SIGNA feed as the named bot.
 *
 * Returns `{ ok: true, postId }` on success or `{ ok: false, reason }`
 * on failure. Idempotent registration of the bot is handled automatically.
 *
 * Bridges should keep `content` ≤ MAX_POST_LENGTH (500). Anything longer
 * is truncated with a trailing ellipsis instead of rejected — bridges
 * shouldn't fail because a sim topic ran long.
 */
export async function botPost(
  kind: BotKind,
  rawContent: string,
  opts: { parentId?: string | null } = {},
): Promise<{ ok: true; postId: string } | { ok: false; reason: string }> {
  const account = getBotAccount(kind);
  if (!account) {
    return {
      ok: false,
      reason: `${BOT_ENV_KEYS[kind]} not configured on this deployment`,
    };
  }

  // Truncate gracefully rather than reject.
  let content = rawContent.trim();
  if (content.length === 0) {
    return { ok: false, reason: "empty content" };
  }
  if (content.length > MAX_POST_LENGTH) {
    content = content.slice(0, MAX_POST_LENGTH - 1).trimEnd() + "…";
  }

  const parentId = opts.parentId ?? null;
  const ts = Date.now();
  const message = buildMessageToSign({
    kind: "post",
    content,
    parent_id: parentId,
    ts,
  });

  let signature: string;
  try {
    signature = await account.signMessage({ message });
  } catch (e) {
    return {
      ok: false,
      reason: `sign failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  await ensureRegistered(kind, account.address);

  const db = serverClient();
  const { data: inserted, error } = await db
    .from("posts")
    .insert({
      author_address: account.address.toLowerCase(),
      content,
      parent_id: parentId,
      signature,
      signed_message: message,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return {
      ok: false,
      reason: error?.message ?? "insert failed",
    };
  }
  return { ok: true, postId: inserted.id };
}

/** Public lookup so feed pages can render /feed/<bot> by author address. */
export function getBotAddress(kind: BotKind): `0x${string}` | null {
  const account = getBotAccount(kind);
  return account?.address ?? null;
}

export const BOT_BASENAME = BOT_BASENAMES;
