import crypto from "node:crypto";

/**
 * Server-side key vault for SIGNA's custodial agent runtime.
 *
 * Agents that opt-in to the runtime hand SIGNA their private key once.
 * We encrypt it with AES-256-GCM using a single server-side master key
 * (env var AGENT_RUNTIME_MASTER_KEY — 32 raw bytes, hex-encoded) and
 * store the ciphertext in agents.encrypted_key.
 *
 * Wire format of the stored ciphertext (base64):
 *
 *   [12 bytes IV] [16 bytes auth tag] [N bytes ciphertext]
 *
 * Rotating the master key requires every launcher to re-hand-off their
 * key. This is intentional: it's an emergency lever, not a UX feature.
 *
 * The plaintext private key NEVER leaves a Node process that has the
 * master key in env. The web app and the Railway runtime service both
 * need the same env var.
 */

function getMasterKey(): Buffer {
  const raw = process.env.AGENT_RUNTIME_MASTER_KEY;
  if (!raw) {
    throw new Error(
      "AGENT_RUNTIME_MASTER_KEY not set — required for custodial agent runtime",
    );
  }
  const hex = raw.startsWith("0x") ? raw.slice(2) : raw;
  if (!/^[a-fA-F0-9]{64}$/.test(hex)) {
    throw new Error(
      "AGENT_RUNTIME_MASTER_KEY must be 32 raw bytes (64 hex chars)",
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypt an agent's private key for storage. Output is a base64 string
 * suitable for the `agents.encrypted_key` text column.
 */
export function encryptAgentKey(plaintextHex: string): string {
  const masterKey = getMasterKey();

  // Normalize the agent private key to a 32-byte buffer.
  const hex = plaintextHex.startsWith("0x")
    ? plaintextHex.slice(2)
    : plaintextHex;
  if (!/^[a-fA-F0-9]{64}$/.test(hex)) {
    throw new Error(
      "agent private key must be 32 raw bytes (64 hex chars, with or without 0x prefix)",
    );
  }
  const plaintext = Buffer.from(hex, "hex");

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/**
 * Decrypt an agent's private key for use by the runtime service. Returns
 * the raw 32-byte key as a 0x-prefixed hex string (viem-compatible).
 */
export function decryptAgentKey(stored: string): `0x${string}` {
  const masterKey = getMasterKey();
  const blob = Buffer.from(stored, "base64");
  if (blob.length < 12 + 16 + 32) {
    throw new Error("encrypted_key blob too short to be valid");
  }
  const iv = blob.subarray(0, 12);
  const authTag = blob.subarray(12, 28);
  const ciphertext = blob.subarray(28);

  const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  if (plaintext.length !== 32) {
    throw new Error(
      `decrypted key has unexpected length ${plaintext.length} (expected 32)`,
    );
  }
  return `0x${plaintext.toString("hex")}` as `0x${string}`;
}

/** Throws on any config issue. Call once during boot to fail fast. */
export function assertVaultConfigured(): void {
  getMasterKey();
}
