/**
 * SIGNA Verifiable Evaluator — a runnable Virtuals ACP evaluator agent.
 *
 *   cp .env.example .env   # fill in from app.virtuals.io (see README)
 *   npm install
 *   npm start
 *
 * WHY THIS EXISTS
 * ACP already proves the AGREEMENT (Proof of Agreement — both agents sign the
 * terms). It does not prove the EVALUATOR, the agent that decides whether work
 * met those terms and therefore whether escrow releases. Virtuals' own docs say
 * the protocol "assumes evaluators act honestly", governance forthcoming.
 *
 * An ordinary evaluator casts: session.complete("Looks good") — free text bound
 * to nothing. It cannot prove which bytes it judged, and it can deny the call
 * later. This agent asks SIGNA to SIGN the verdict, bound to the exact job,
 * terms and deliverable, before casting it. The proof rides into ACP's own
 * record via the reason string, and anyone can re-check it:
 *
 *   POST https://www.signaagent.xyz/api/verify  { ...evaluation, kind: "acp_evaluation" }
 *
 * SIGNA holds no escrow and moves no funds. It signs what was judged.
 */
import { AcpAgent, PrivyAlchemyEvmProviderAdapter } from "@virtuals-protocol/acp-node-v2";
import { base } from "@account-kit/infra";

const SIGNA = process.env.SIGNA_URL ?? "https://www.signaagent.xyz";

// ── config ────────────────────────────────────────────────────────────────────
// All secrets come from the environment. Never hard-code the signer key; it is
// generated in the Signers tab of your agent page and belongs only in .env.
const required = ["ACP_WALLET_ADDRESS", "ACP_WALLET_ID", "ACP_SIGNER_PRIVATE_KEY"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing env: ${missing.join(", ")}\nSee README.md — values come from app.virtuals.io/acp/agents/`);
  process.exit(1);
}

/** Ask SIGNA to judge (or notarise your judgement) and sign it. */
async function signaEvaluate({ jobId, terms, deliverable, requester, provider, verdict, reasoning, requiredElements }) {
  const r = await fetch(`${SIGNA}/api/acp/evaluate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      job_id: String(jobId),
      terms,
      deliverable,
      requester,
      provider,
      verdict,                          // optional: your model already decided → SIGNA notarises it
      reasoning,                        // optional: why
      required_elements: requiredElements, // optional: deterministic presence check
    }),
  });
  if (!r.ok) throw new Error(`signa evaluate ${r.status}: ${await r.text().catch(() => "")}`);
  return r.json();
}

/**
 * The agreed requirements. Source these from however your offering encodes them.
 * They get bound into the signature, so they must be the terms BOTH agents
 * actually agreed to — not something invented at evaluation time.
 */
function termsFor(session) {
  const req = session.job?.requirement ?? session.job?.description ?? "";
  if (Array.isArray(req)) return req.map(String);
  if (req && typeof req === "object") return Object.values(req).map(String);
  return String(req).split(/\r?\n|;/).map((s) => s.trim()).filter(Boolean);
}

/** Pull the submitted work out of the entry; field placement varies by SDK version. */
function deliverableFrom(session, entry) {
  const ev = entry?.event ?? {};
  const direct = ev.deliverable ?? ev.payload ?? ev.content ?? ev.data;
  if (direct !== undefined && direct !== null && direct !== "") return direct;
  const msgs = (session.entries ?? []).filter((e) => e.kind === "message");
  return msgs.length ? msgs[msgs.length - 1].content : "";
}

const agent = await AcpAgent.create({
  provider: await PrivyAlchemyEvmProviderAdapter.create({
    walletAddress: process.env.ACP_WALLET_ADDRESS,
    walletId: process.env.ACP_WALLET_ID,
    signerPrivateKey: process.env.ACP_SIGNER_PRIVATE_KEY,
    chains: [base],
    ...(process.env.ACP_BUILDER_CODE ? { builderCode: process.env.ACP_BUILDER_CODE } : {}),
  }),
});

agent.on("entry", async (session, entry) => {
  // Only the evaluator role can complete/reject, and only once work is submitted.
  if (entry.kind !== "system" || entry.event?.type !== "job.submitted") return;
  if (session.roles && !session.roles.includes?.("evaluator")) return;

  const terms = termsFor(session);
  const deliverable = deliverableFrom(session, entry);

  try {
    const { evaluation, reason } = await signaEvaluate({
      jobId: session.jobId,
      terms,
      deliverable,
      requester: session.job?.clientAddress,
      provider: session.job?.providerAddress,
    });

    if (evaluation.verdict === "complete") await session.complete(reason);
    else await session.reject(reason);

    console.log(`[signa] job ${session.jobId} -> ${evaluation.verdict} (method: ${evaluation.method})`);
    console.log(`[signa] deliverable ${evaluation.deliverable_hash.slice(0, 16)} signed by ${evaluation.evaluator}`);
    if (evaluation.missing?.length) console.log(`[signa] missing: ${evaluation.missing.join("; ")}`);
  } catch (e) {
    // FAIL CLOSED. Never silently approve work you could not verify — an
    // approval releases escrow, so an unverified "complete" is the one
    // irreversible mistake this agent must not make.
    console.error(`[signa] evaluation unavailable for job ${session.jobId}, casting no verdict:`, e.message);
  }
});

await agent.start();
console.log(`[signa] verifiable evaluator online as ${process.env.ACP_WALLET_ADDRESS}`);
console.log(`[signa] verdicts signed by SIGNA and re-checkable at ${SIGNA}/acp`);
