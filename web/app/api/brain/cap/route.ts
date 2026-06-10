import { NextRequest, NextResponse } from "next/server";
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, toBytes } from "viem";
import { createHash } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * GET /api/brain/cap?arg=<question>
 *
 * The PRICED brain product, shaped for the capability gateway: one reasoning
 * run on decentralized inference, answered fast and signed by the brain's own
 * wallet. This is what `signa.brain` (0.01 USDC over x402) sells on the open
 * marketplace — the gateway verifies the buyer's payment to the brain wallet
 * BEFORE proxying here, so a paid call is enforced upstream; this endpoint
 * stays stateless and fast (the proxy allows ~8s).
 *
 * The brain both EARNS here (x402 payments to its wallet) and SPENDS from
 * human-granted mandates on /api/brain — a closed, verifiable agent economy.
 * The brain-signed attestation is portable: verify offline with viem against
 * the brain address; no trust in this server required.
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const brain = privateKeyToAccount(keccak256(toBytes("signa:brain:v1")));

async function reasonOnce(origin: string, prompt: string, timeoutMs: number): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${origin}/api/gateway/respond`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt }),
      signal: ctrl.signal,
    });
    const j = await r.json().catch(() => ({}));
    return (j?.response ?? "").toString().trim();
  } finally {
    clearTimeout(t);
  }
}

export async function GET(req: NextRequest) {
  const goal = (req.nextUrl.searchParams.get("arg") ?? req.nextUrl.searchParams.get("goal") ?? "").trim();
  if (goal.length < 2) return NextResponse.json({ ok: false, error: "missing_arg", hint: "?arg=<your question>" }, { status: 400, headers: CORS });
  if (goal.length > 600) return NextResponse.json({ ok: false, error: "arg_too_long" }, { status: 400, headers: CORS });

  const origin = req.nextUrl.origin;
  const prompt =
    `You are the SIGNA Brain answering a paid, single-shot reasoning request. ` +
    `Answer concisely and concretely in plain text (no markdown headers), 1-4 sentences.\n\nQuestion: ${goal}`;

  // one retry inside the gateway-proxy window — paid calls should not flake
  let answer = "";
  try { answer = await reasonOnce(origin, prompt, 3500); } catch { /* retry */ }
  if (!answer) { try { answer = await reasonOnce(origin, prompt, 3500); } catch { /* */ } }
  if (!answer) return NextResponse.json({ ok: false, error: "inference_unavailable", hint: "retry shortly" }, { status: 503, headers: CORS });

  const ts = Date.now();
  const answerHash = createHash("sha256").update(answer).digest("hex");
  const preimage = ["SIGNA brain answer v1", `ts:${ts}`, `goal:${goal}`, `answer:${answerHash}`].join("\n");
  const signature = await brain.signMessage({ message: preimage });

  return NextResponse.json(
    {
      ok: true,
      goal,
      answer,
      ts,
      brain: brain.address.toLowerCase(),
      signature,
      verify: { scheme: "eip191", preimage, how: "sha256 the answer, rebuild the preimage, viem.verifyMessage against `brain`" },
      product: "signa.brain — one reasoning run, signed by the brain wallet. Paid over x402 via /api/capabilities/invoke?cap=signa.brain.",
    },
    { headers: CORS },
  );
}
