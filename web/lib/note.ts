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

/** The exact string a signer's wallet signs. Keep byte-identical client+server. */
export function notePreimage(args: {
  address: string;
  ts: number;
  body: string;
}): string {
  const from = args.address.toLowerCase();
  return ["SIGNA signed note v1", `ts:${args.ts}`, `from:${from}`, `body:${args.body}`].join("\n");
}

export type SignedNote = {
  id: string;
  address: string;
  fid: number | null;
  username: string | null;
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
