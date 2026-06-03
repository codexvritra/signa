/**
 * Signed notes — the consumer-simple face of the SIGNA message layer.
 *
 * A "note" is a short public statement a human (or agent) signs with their
 * wallet (EIP-191 personal_sign). The signature binds the signer + timestamp
 * + body, so anyone can re-verify who said it with viem.recoverMessageAddress
 * over the canonical preimage below — no trust in SIGNA.
 *
 * This module is the ONE place the preimage is defined, imported by both the
 * Mini App client (to sign) and the API route (to verify before insert). It is
 * a "raw" preimage for /api/verify: POST { kind:"raw", preimage, expected, signature }.
 */

export const NOTE_MAX_BODY = 280;
export const TO_LABEL_MAX = 64;

/**
 * Normalize a recipient label: lowercase, strip a leading "@", trim. Keeps
 * only handle-safe chars (a–z, 0–9, _ . -) OR a full 0x address. Returns null
 * if nothing usable remains. The same function is used to store and to query,
 * so links and inboxes always agree.
 */
export function sanitizeTo(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = String(input).trim().toLowerCase();
  if (s.startsWith("@")) s = s.slice(1);
  if (/^0x[a-f0-9]{40}$/.test(s)) return s;
  s = s.replace(/[^a-z0-9_.\-]/g, "");
  if (s.length < 1) return null;
  return s.slice(0, TO_LABEL_MAX);
}

/**
 * The exact string a signer's wallet signs. Keep byte-identical client+server.
 * When `to` is present the recipient is bound into the signature, so a directed
 * message can't be silently re-pointed at someone else.
 */
export function notePreimage(args: {
  address: string;
  ts: number;
  body: string;
  to?: string | null;
}): string {
  const from = args.address.toLowerCase();
  const lines = ["SIGNA signed note v1", `ts:${args.ts}`, `from:${from}`];
  const to = sanitizeTo(args.to);
  if (to) lines.push(`to:${to}`);
  lines.push(`body:${args.body}`);
  return lines.join("\n");
}

export type SignedNote = {
  id: string;
  address: string;
  fid: number | null;
  username: string | null;
  to_label: string | null;
  body: string;
  ts: number;
  signature: string;
  signed_message: string;
  created_at: string;
};

/** 0x1234…abcd */
export function shortAddr(a: string): string {
  if (!a || a.length < 10) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
