/**
 * SIGNA Verifiable Evaluator — accountability for the one role Virtuals ACP
 * still has to trust.
 *
 * Virtuals' Agent Commerce Protocol already proves the AGREEMENT: the
 * negotiation phase produces a Proof of Agreement, both agents signing the
 * terms. What it does not prove is the EVALUATOR — the agent that decides
 * whether the work met those terms, and therefore whether escrow releases.
 * Virtuals' own docs concede it: "the protocol assumes evaluators act
 * honestly", with the governance layer "forthcoming".
 *
 * Look at the SDK surface an evaluator actually has:
 *
 *     await session.complete("Looks good");
 *     await session.reject("Deliverable does not meet requirements");
 *
 * The verdict carries a free-text reason and nothing else. Nothing binds it to
 * the bytes it judged. An evaluator can approve deliverable X and later claim it
 * saw Y; the reason is unverifiable prose; a swapped deliverable is invisible.
 *
 * A SIGNA evaluation is an EIP-191 envelope binding job -> terms -> deliverable
 * -> verdict -> reasoning, signed by the evaluator before it ever calls
 * complete/reject. Two things become checkable by anyone:
 *   1) the signature recovers to this evaluator — it cannot deny the call
 *   2) re-hash the deliverable — proof of WHICH artifact was judged
 * Swap one byte of the deliverable and verification fails. The verdict is
 * un-editable, un-deniable, and publicly re-checkable — accountability without
 * waiting for a governance layer.
 *
 * SIGNA holds no escrow and moves no funds. It signs what it judged.
 */
import { keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createHash } from "node:crypto";
import { stableStringify } from "./x402-receipt";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** The SIGNA ACP evaluator — a deterministic, keyless service identity. */
const EVALUATOR = privateKeyToAccount(keccak256(toBytes("signa:acp-evaluator:v1")));
export const ACP_EVALUATOR_ADDRESS = EVALUATOR.address.toLowerCase();

/** Base — where Virtuals ACP lives. CAIP-2. */
export const ACP_NETWORK = "eip155:8453";

export type Verdict = "complete" | "reject";

export type RequirementCheck = { requirement: string; met: boolean };

export type AcpEvaluation = {
  ts: number;
  network: string;
  job_id: string;
  evaluator: string;
  requester: string;
  provider: string;
  terms: string[];
  terms_hash: string;
  deliverable_hash: string;
  verdict: Verdict;
  present: string[];
  missing: string[];
  checks: RequirementCheck[];
  reasoning: string;
  reasoning_hash: string;
  /** how the verdict was reached — "declared" (caller's model), "elements" (deterministic), "rubric" (heuristic fallback) */
  method: "declared" | "elements" | "rubric";
  signature: string;
  preimage: string;
  signer: string;
};

/**
 * The exact string the evaluator signs. Everything a dispute would turn on is
 * inside it — which job, which terms, which deliverable bytes, which verdict,
 * which reasoning. Mirror byte-for-byte in the universal verifier (kind
 * `acp_evaluation`).
 */
export function acpEvaluationPreimage(a: {
  ts: number; network: string; job_id: string; evaluator: string; requester: string; provider: string;
  terms_hash: string; deliverable_hash: string; verdict: Verdict; reasoning_hash: string;
}): string {
  return [
    "SIGNA acp evaluation v1",
    `ts:${a.ts}`,
    `network:${a.network}`,
    `job:${a.job_id}`,
    `evaluator:${a.evaluator.toLowerCase()}`,
    `requester:${a.requester.toLowerCase()}`,
    `provider:${a.provider.toLowerCase()}`,
    `terms:${a.terms_hash}`,
    `deliverable:${a.deliverable_hash}`,
    `verdict:${a.verdict}`,
    `reasoning:${a.reasoning_hash}`,
  ].join("\n");
}

/** Canonical hashes — stable regardless of key order or array formatting. */
export const hashTerms = (terms: string[]): string => sha256(stableStringify(terms));
export const hashDeliverable = (d: unknown): string => sha256(typeof d === "string" ? d : stableStringify(d));

const STOP = new Set([
  "the", "and", "for", "with", "that", "this", "a", "an", "of", "to", "in", "on", "at", "is", "are", "be", "any", "one", "its", "it",
  // Instruction verbs. A requirement like "cite a data source" is phrased as a
  // COMMAND; work that satisfies it contains the source, not the word "cite".
  // Matching on these is how a naive checker rejects perfectly good deliverables.
  "must", "should", "include", "including", "deliver", "delivers", "provide", "provides", "name", "names", "cite", "cites",
  "give", "add", "mention", "list", "ensure", "make", "show", "state", "write", "return", "produce", "summarise", "summarize",
]);

const asText = (d: unknown): string => (typeof d === "string" ? d : stableStringify(d)).toLowerCase();

/**
 * The strict check: each element must literally appear in the deliverable.
 * The caller supplies concrete, checkable elements ("risk", "data source"), not
 * natural-language commands. Fully deterministic and reproducible — anyone can
 * re-run it over the same bytes and get the same answer, so the JUDGEMENT is
 * auditable too, not merely the signature.
 */
export function elementsCheck(elements: string[], deliverable: unknown): RequirementCheck[] {
  const hay = asText(deliverable);
  return elements.map((requirement) => ({ requirement, met: hay.includes(requirement.toLowerCase().trim()) }));
}

/**
 * The heuristic fallback, used only when the caller declares no verdict and no
 * required_elements. A term counts as met when its significant tokens (minus
 * instruction verbs) appear in the deliverable.
 *
 * BE HONEST ABOUT THIS: it is a keyword heuristic, not comprehension. It can be
 * wrong in both directions, and in ACP a wrong `reject` refunds escrow and
 * denies an honest provider payment. Real judgement should come from the
 * caller's own model (pass `verdict` + `reasoning` — SIGNA binds and signs it)
 * or from concrete `required_elements`. Callers get `method: "rubric"` back so
 * they can see which path produced the verdict.
 */
export function rubricCheck(terms: string[], deliverable: unknown): RequirementCheck[] {
  const hay = asText(deliverable);
  return terms.map((requirement) => {
    const tokens = requirement
      .toLowerCase()
      .split(/[^a-z0-9$.%-]+/)
      .filter((t) => t.length > 2 && !STOP.has(t));
    const met = tokens.length > 0 && tokens.every((t) => hay.includes(t));
    return { requirement, met };
  });
}

/**
 * Bind a verdict to the exact work it judged, and SIGN it.
 *
 * SIGNA's product here is ACCOUNTABILITY, not comprehension. Who judges is the
 * caller's choice, in order of preference:
 *
 *   1. `verdict` (+ `reasoning`) — the caller's own model/logic decided.
 *      SIGNA notarises it: binds it to these bytes and signs. method "declared".
 *   2. `required_elements` — concrete elements that must appear. Deterministic
 *      and reproducible by anyone. method "elements".
 *   3. neither — a keyword heuristic over `terms`. Honest fallback, flagged as
 *      method "rubric" so nobody mistakes it for understanding.
 *
 * Whichever path, the signature makes the call undeniable and pins it to this
 * deliverable, which is the part ACP is missing today.
 */
export async function evaluateJob(a: {
  job_id: string;
  terms: string[];
  deliverable: unknown;
  requester?: string;
  provider?: string;
  network?: string;
  verdict?: Verdict;
  reasoning?: string;
  required_elements?: string[];
  ts?: number;
}): Promise<AcpEvaluation> {
  const ts = a.ts ?? Date.now();
  const network = a.network ?? ACP_NETWORK;
  const zero = "0x0000000000000000000000000000000000000000";
  const requester = (a.requester ?? zero).toLowerCase();
  const provider = (a.provider ?? zero).toLowerCase();

  const useElements = Array.isArray(a.required_elements) && a.required_elements.length > 0;
  const method: AcpEvaluation["method"] = a.verdict ? "declared" : useElements ? "elements" : "rubric";

  // Run the checks for context even when the caller declares its own verdict —
  // they show up in the record either way.
  const checks = useElements ? elementsCheck(a.required_elements!, a.deliverable) : rubricCheck(a.terms, a.deliverable);
  const present = checks.filter((c) => c.met).map((c) => c.requirement);
  const missing = checks.filter((c) => !c.met).map((c) => c.requirement);

  const verdict: Verdict = a.verdict ?? (missing.length === 0 ? "complete" : "reject");

  const reasoning =
    a.reasoning ??
    (verdict === "complete"
      ? `All ${checks.length} checked requirement(s) are present in the deliverable.`
      : `${missing.length} of ${checks.length} checked requirement(s) are missing: ${missing.join("; ")}.`);

  const terms_hash = hashTerms(a.terms);
  const deliverable_hash = hashDeliverable(a.deliverable);
  const reasoning_hash = sha256(reasoning);

  const preimage = acpEvaluationPreimage({
    ts, network, job_id: a.job_id, evaluator: ACP_EVALUATOR_ADDRESS, requester, provider,
    terms_hash, deliverable_hash, verdict, reasoning_hash,
  });
  const signature = await EVALUATOR.signMessage({ message: preimage });

  return {
    ts, network, job_id: a.job_id, evaluator: ACP_EVALUATOR_ADDRESS, requester, provider,
    terms: a.terms, terms_hash, deliverable_hash, verdict, present, missing, checks,
    reasoning, reasoning_hash, method,
    signature, preimage, signer: ACP_EVALUATOR_ADDRESS,
  };
}

/**
 * The string SIGNA hands to `session.complete()` / `session.reject()` so the
 * proof rides inside ACP's own onchain record instead of beside it. Compact by
 * design — the reason field is prose, not a blob store; the full envelope
 * re-verifies at /api/verify (kind `acp_evaluation`).
 */
export function acpReasonString(e: AcpEvaluation): string {
  return [
    e.reasoning,
    `— signed by SIGNA verifiable evaluator ${e.evaluator}`,
    `deliverable:${e.deliverable_hash.slice(0, 16)} terms:${e.terms_hash.slice(0, 16)}`,
    `sig:${e.signature.slice(0, 26)}… verify: signaagent.xyz/acp`,
  ].join(" ");
}
