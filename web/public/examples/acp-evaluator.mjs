/**
 * SIGNA Verifiable Evaluator — drop-in for Virtuals ACP (Agent Commerce Protocol).
 *
 *   npm i @virtuals-protocol/acp-node-v2
 *   node acp-evaluator.mjs
 *
 * WHY
 * ACP already proves the AGREEMENT: the negotiation phase produces a Proof of
 * Agreement, both agents signing the terms. It does not prove the EVALUATOR —
 * the agent that decides whether work met those terms and therefore whether
 * escrow releases. Virtuals' own docs say the protocol "assumes evaluators act
 * honestly", with the governance layer forthcoming.
 *
 * Look at what an evaluator actually returns:
 *
 *     await session.complete("Looks good");
 *
 * Free text, bound to nothing. It doesn't prove which bytes were judged, and
 * the evaluator can deny or rewrite the call later. Nobody can audit it.
 *
 * WHAT THIS DOES
 * Before calling complete()/reject(), it asks SIGNA for a SIGNED verdict bound
 * to the exact job, terms and deliverable. The proof then rides inside ACP's own
 * onchain record via the reason string. Anyone can afterwards:
 *   1. recover the signature  → this evaluator really made this call
 *   2. re-hash the deliverable → this is the artifact it judged (swap one byte → fails)
 * Verify any verdict:  POST https://www.signaagent.xyz/api/verify
 *                      { ...evaluation, kind: "acp_evaluation" }
 *
 * SIGNA holds no escrow and moves no funds. It signs what it judged.
 */
import { AcpAgent, JobSession, JobRoomEntry } from "@virtuals-protocol/acp-node-v2";

const SIGNA = process.env.SIGNA_URL ?? "https://www.signaagent.xyz";

/**
 * Ask SIGNA to judge + sign. Returns { evaluation, reason }.
 * `reason` is what you hand to session.complete()/session.reject().
 */
export async function signaEvaluate({ jobId, terms, deliverable, requester, provider }) {
  const r = await fetch(`${SIGNA}/api/acp/evaluate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ job_id: String(jobId), terms, deliverable, requester, provider }),
  });
  if (!r.ok) throw new Error(`signa evaluate failed: ${r.status}`);
  return r.json();
}

/**
 * The agreed requirements. Source these from however your offering encodes them
 * — the job's requirement schema, the offering description, or the negotiated
 * message. They are what the verdict gets bound to, so they must be the terms
 * BOTH agents actually agreed to, not something you invent at evaluation time.
 */
function termsFor(session) {
  const req = session.job?.requirement ?? session.job?.description ?? "";
  if (Array.isArray(req)) return req.map(String);
  if (req && typeof req === "object") return Object.values(req).map(String);
  return String(req).split(/\r?\n|;/).map((s) => s.trim()).filter(Boolean);
}

/**
 * Pull the submitted work out of the entry. Field placement varies by SDK
 * version, so read defensively and fall back to the provider's last message.
 */
function deliverableFrom(session, entry) {
  const ev = entry?.event ?? {};
  const direct = ev.deliverable ?? ev.payload ?? ev.content ?? ev.data;
  if (direct !== undefined && direct !== null && direct !== "") return direct;
  const msgs = (session.entries ?? []).filter((e) => e.kind === "message");
  return msgs.length ? msgs[msgs.length - 1].content : "";
}

const agent = new AcpAgent({
  // ...your ACP client config (wallet, chains: [base], builderCode, etc.)
});

agent.on("entry", async (session /* JobSession */, entry /* JobRoomEntry */) => {
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

    // The verdict is signed and bound to `deliverable` before it is cast.
    // `reason` carries the proof into ACP's own record.
    if (evaluation.verdict === "complete") await session.complete(reason);
    else await session.reject(reason);

    console.log(`[signa] job ${session.jobId} -> ${evaluation.verdict}`);
    console.log(`[signa] deliverable ${evaluation.deliverable_hash.slice(0, 16)} signed by ${evaluation.evaluator}`);
    if (evaluation.missing.length) console.log(`[signa] missing: ${evaluation.missing.join("; ")}`);
  } catch (e) {
    // Fail closed: never silently approve work you could not verify.
    console.error("[signa] evaluation unavailable, not casting a verdict:", e.message);
  }
});

await agent.start();
