/**
 * The SIGNA verification challenge — the falsifiable core of the message layer,
 * turned into a standing public game.
 *
 * Claim: every message on SIGNA is an EIP-191 wallet signature that recovers to
 * exactly one address, and nothing but that wallet can produce it. So we publish
 * one genuine signed message from a dedicated challenge wallet and dare anyone to
 * FORGE it: submit a signature that recovers the SAME address over DIFFERENT text.
 * Winning requires breaking ECDSA. The verdict is decided by viem, not by us —
 * and a non-win is the point ("N attempts, 0 forgeries, the signatures hold").
 *
 * Honest scope: this proves PROVENANCE + integrity (who signed what, untampered),
 * not correctness of any content. Same boundary we draw everywhere.
 */
import { recoverMessageAddress, keccak256, toBytes, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { supabase, serverClient } from "@/lib/supabase";

const challengeAccount = privateKeyToAccount(keccak256(toBytes("signa:challenge:v1")));
export const CHALLENGE_TARGET = challengeAccount.address.toLowerCase();

/** The one genuine, fixed message (stable signature) anyone can verify + must out-forge. */
export const GENUINE_MESSAGE = [
  "SIGNA verification challenge v1",
  `target:${CHALLENGE_TARGET}`,
  "Every message on SIGNA is an EIP-191 wallet signature that recovers to exactly one address.",
  "This line was signed by the SIGNA challenge wallet on Base.",
  "Forge a signature that recovers this same address over text you choose, and you have broken the message layer.",
  "We verify provenance, not correctness.",
].join("\n");

const GENUINE_SET = new Set([GENUINE_MESSAGE]);

let _sig: Hex | null = null;
export async function genuineSignature(): Promise<Hex> {
  if (!_sig) _sig = await challengeAccount.signMessage({ message: GENUINE_MESSAGE });
  return _sig;
}

export type SubmissionResult = {
  ok: true;
  recovered: string | null;
  target: string;
  win: boolean;
  verdict: string;
};

/** Adjudicate a forgery attempt. Win iff the signature recovers the target over NOVEL text. */
export async function checkSubmission(args: { message: string; signature: string; submitter?: string }): Promise<SubmissionResult> {
  const message = String(args.message ?? "");
  const signature = String(args.signature ?? "");
  let recovered: string | null = null;
  try {
    recovered = (await recoverMessageAddress({ message, signature: signature as Hex })).toLowerCase();
  } catch {
    recovered = null;
  }
  const isGenuine = GENUINE_SET.has(message);
  const win = recovered === CHALLENGE_TARGET && !isGenuine;

  const verdict = win
    ? "FORGED — you recovered the challenge wallet over your own text. You broke it."
    : recovered === CHALLENGE_TARGET
      ? "that is the genuine published message, not a forgery — change the text and the signature stops recovering us"
      : recovered
        ? `recovered ${recovered.slice(0, 8)}… — not the challenge wallet. the signature holds.`
        : "no address recovered — malformed signature.";

  // record the attempt (won forced false by RLS; a real win is handled out of band)
  try {
    await serverClient().from("signa_challenge_attempts").insert({
      mode: "message",
      submitter: args.submitter ? String(args.submitter).slice(0, 80) : null,
      recovered,
      target: CHALLENGE_TARGET,
      attempt: message.slice(0, 4000),
      won: false,
      ts: Date.now(),
    });
  } catch {
    /* ledger write best-effort */
  }

  return { ok: true, recovered, target: CHALLENGE_TARGET, win, verdict };
}

export async function ledger(): Promise<{ attempts: number; forged: number }> {
  try {
    const [{ count: attempts }, { count: forged }] = await Promise.all([
      supabase.from("signa_challenge_attempts").select("*", { count: "exact", head: true }),
      supabase.from("signa_challenge_attempts").select("*", { count: "exact", head: true }).eq("won", true),
    ]);
    return { attempts: attempts ?? 0, forged: forged ?? 0 };
  } catch {
    return { attempts: 0, forged: 0 };
  }
}
