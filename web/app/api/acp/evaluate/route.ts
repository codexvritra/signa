import { NextRequest, NextResponse } from "next/server";
import { evaluateJob, acpReasonString, ACP_EVALUATOR_ADDRESS, ACP_NETWORK } from "@/lib/acp";
import { verifyArtifact } from "@/lib/verify-artifact";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/acp/evaluate — the SIGNA verifiable evaluator for Virtuals ACP.
 *
 *   POST { job_id, terms: string[], deliverable, requester?, provider?, network?, reasoning? }
 *     → a signed verdict bound to the exact deliverable bytes, plus the
 *       `reason` string to hand to session.complete() / session.reject().
 *   GET → the schema + the evaluator's identity.
 *
 * SIGNA holds no escrow and moves no funds. It signs what it judged, so the
 * verdict can neither be denied later nor re-pointed at a different artifact.
 */
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type" } as const;
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      evaluator: ACP_EVALUATOR_ADDRESS,
      network: ACP_NETWORK,
      verify_kind: "acp_evaluation",
      what:
        "Virtuals ACP proves the agreement (Proof of Agreement). It does not prove the evaluator — its own docs assume evaluators act honestly. SIGNA binds each verdict to the exact job, terms and deliverable it judged, and signs it.",
      how: "POST { job_id, terms: string[], deliverable, requester?, provider?, network?, verdict?, reasoning?, required_elements? }",
      returns: "{ evaluation, reason } — pass `reason` to session.complete()/session.reject(); re-verify `evaluation` at /api/verify (kind acp_evaluation)",
      who_judges:
        "SIGNA's product is accountability, not comprehension. Preferred: pass your own `verdict` + `reasoning` (from your model) and SIGNA notarises it — method 'declared'. Or pass concrete `required_elements` for a deterministic, reproducible presence check — method 'elements'. With neither, a keyword heuristic over `terms` runs and is flagged method 'rubric' — do not mistake it for understanding.",
      guarantees: [
        "the signature recovers to this evaluator — it cannot deny the call",
        "the verdict is bound to a hash of the exact deliverable — swap one byte and verification fails",
        "the reasoning is hashed into the envelope — the stated reason cannot be rewritten after the fact",
      ],
    },
    { headers: CORS },
  );
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));

  const job_id = String(b.job_id ?? "").trim();
  if (!job_id) return NextResponse.json({ ok: false, error: "job_id required" }, { status: 400, headers: CORS });

  const terms: unknown = b.terms;
  if (!Array.isArray(terms) || terms.length === 0 || !terms.every((t) => typeof t === "string" && t.trim())) {
    return NextResponse.json({ ok: false, error: "terms must be a non-empty string[] — the agreed requirements" }, { status: 400, headers: CORS });
  }
  if (b.deliverable === undefined || b.deliverable === null || b.deliverable === "") {
    return NextResponse.json({ ok: false, error: "deliverable required — the work being judged" }, { status: 400, headers: CORS });
  }

  if (b.verdict !== undefined && b.verdict !== "complete" && b.verdict !== "reject") {
    return NextResponse.json({ ok: false, error: "verdict must be 'complete' or 'reject'" }, { status: 400, headers: CORS });
  }

  const evaluation = await evaluateJob({
    job_id,
    terms: terms as string[],
    deliverable: b.deliverable,
    requester: typeof b.requester === "string" ? b.requester : undefined,
    provider: typeof b.provider === "string" ? b.provider : undefined,
    network: typeof b.network === "string" ? b.network : undefined,
    verdict: b.verdict,
    reasoning: typeof b.reasoning === "string" ? b.reasoning : undefined,
    required_elements: Array.isArray(b.required_elements) ? b.required_elements.filter((e: unknown) => typeof e === "string") : undefined,
  });

  // Re-verify our own output before returning it — never hand back a signature we haven't checked.
  const reverify = await verifyArtifact({ ...evaluation, kind: "acp_evaluation" });

  return NextResponse.json(
    { ok: true, evaluation, reason: acpReasonString(evaluation), reverify, verify_kind: "acp_evaluation" },
    { headers: CORS },
  );
}
