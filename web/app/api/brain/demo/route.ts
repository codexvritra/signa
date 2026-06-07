import { NextRequest, NextResponse } from "next/server";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { keccak256, toBytes } from "viem";
import { mandatePreimage, USDC_BASE, NETWORK_BASE } from "@/lib/mandate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/brain/demo — the metered brain, live.
 *
 * A human grants the SIGNA brain a one-run budget. The brain reasons toward a
 * goal and pays for its OWN inference within that budget — a real EIP-3009
 * USDC-on-Base authorization, a verifiable x402 receipt, a capped spend. The
 * budget is now empty, so the next run stops and the brain wallet-signs a
 * request for more. The brain holds no funds; SIGNA enforces the cap. Every
 * step is a real signature; nothing is broadcast.
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const brainAddr = privateKeyToAccount(keccak256(toBytes("signa:brain:v1"))).address.toLowerCase();
const usd = (raw: string) => {
  try { return (Number(BigInt(raw)) / 1e6).toFixed(3).replace(/0+$/, "").replace(/\.$/, ""); } catch { return raw; }
};

export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const human = privateKeyToAccount(generatePrivateKey());
  const grantor = human.address.toLowerCase();
  const PRICE = "10000"; // 0.01 USDC / reasoning run (matches the brain's meter)
  const goal = "In one sentence, what is SIGNA?";

  const post = (path: string, body: unknown) =>
    fetch(`${origin}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

  const steps: Array<{ who: string; text: string; status: "grant" | "ok" | "ask"; link?: string }> = [];

  // 1) human grants the brain a one-run budget
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  const ts = Date.now();
  const sig = await human.signMessage({
    message: mandatePreimage({ ts, grantor, agent: brainAddr, asset: USDC_BASE, network: NETWORK_BASE, limit: PRICE, perTx: PRICE, expiry, memo: "brain inference budget" }),
  });
  const m = await post("/api/mandates", { grantor, agent: brainAddr, asset: USDC_BASE, network: NETWORK_BASE, limit: PRICE, per_tx: PRICE, expiry, memo: "brain inference budget", ts, signature: sig });
  if (!m.ok) return NextResponse.json({ ok: false, error: `mandate: ${m.error}` }, { status: 500, headers: CORS });
  const mandateId = m.mandate.id;
  steps.push({ who: "human", text: `granted the brain a ${usd(PRICE)} USDC budget — enough for one reasoning run`, status: "grant" });

  // 2) the brain reasons + pays for its own compute within the budget
  const r1 = await post("/api/brain", { goal, mandate_id: mandateId });
  const s1 = r1?.spend;
  if (s1?.ok) {
    steps.push({
      who: "brain",
      text: `reasoned and paid ${usd(s1.paid_raw)} USDC for its own inference · x402 receipt ✓ · ${usd(s1.remaining_raw)} left`,
      status: "ok",
      link: s1.receipt_id ? `/x402/${s1.receipt_id}` : undefined,
    });
    steps.push({ who: "brain", text: `answer: ${String(r1.answer ?? "").slice(0, 160)}`, status: "ok" });
  } else {
    steps.push({ who: "brain", text: `could not meter this run (${s1?.error ?? "unknown"})`, status: "ask" });
  }

  // 3) budget now empty — the brain stops and asks for more
  const r2 = await post("/api/brain", { goal, mandate_id: mandateId });
  const s2 = r2?.spend;
  if (s2 && s2.budget_exhausted) {
    steps.push({ who: "brain", text: `out of budget — wallet-signed a request for more instead of overspending`, status: "ask" });
  }

  return NextResponse.json(
    { ok: true, grantor, brain: brainAddr, mandate_id: mandateId, request_id: s2?.request_id ?? null, steps },
    { headers: CORS },
  );
}
