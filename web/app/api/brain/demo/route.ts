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
  const LIMIT = "100000"; // 0.10 USDC budget
  const PERTX = "50000"; // 0.05 per-purchase cap
  const goal = "Fetch the premium market-data capability and give a one-line read.";

  const post = (path: string, body: unknown) =>
    fetch(`${origin}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
  const sum = (arr: Array<{ paid_raw: string }>) => arr.reduce((a, c) => a + BigInt(c.paid_raw), 0n).toString();

  const steps: Array<{ who: string; text: string; status: "grant" | "ok" | "buy" | "answer"; link?: string }> = [];

  // 1) a human grants the brain a real working budget (compute + services)
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  const ts = Date.now();
  const sig = await human.signMessage({
    message: mandatePreimage({ ts, grantor, agent: brainAddr, asset: USDC_BASE, network: NETWORK_BASE, limit: LIMIT, perTx: PERTX, expiry, memo: "brain working budget" }),
  });
  const m = await post("/api/mandates", { grantor, agent: brainAddr, asset: USDC_BASE, network: NETWORK_BASE, limit: LIMIT, per_tx: PERTX, expiry, memo: "brain working budget", ts, signature: sig });
  if (!m.ok) return NextResponse.json({ ok: false, error: `mandate: ${m.error}` }, { status: 500, headers: CORS });
  const mandateId = m.mandate.id;
  steps.push({ who: "human", text: `granted the brain a ${usd(LIMIT)} USDC budget (max ${usd(PERTX)} per purchase)`, status: "grant" });

  // 2) the brain reasons, pays for its own inference, and buys a priced
  //    service — all within the budget. Directed at the demo priced cap.
  const r = await post("/api/brain", { goal, mandate_id: mandateId, use: ["demo.premium:base"] });
  const s = r?.spend;
  if (s?.ok) {
    steps.push({
      who: "brain",
      text: `reasoned and paid ${usd(s.paid_raw)} USDC for its own inference · x402 receipt ✓`,
      status: "ok",
      link: s.receipt_id ? `/x402/${s.receipt_id}` : undefined,
    });
  }
  const caps: Array<{ cap: string; paid_raw: string; pay_to: string; remaining_raw: string }> = Array.isArray(r?.paid_caps) ? r.paid_caps : [];
  if (caps.length) {
    const total = sum(caps);
    const left = caps[caps.length - 1].remaining_raw;
    steps.push({
      who: "brain",
      text: `bought premium data — ${usd(total)} USDC paid to the provider${caps.length > 1 ? ` (${caps.length}×)` : ""}, within budget · ${usd(left)} left`,
      status: "buy",
    });
  }
  const ans = String(r?.answer ?? "");
  const real = ans && !/momentarily|unavailable/i.test(ans);
  steps.push({ who: "brain", text: real ? `answer: ${ans.slice(0, 160)}` : `used the premium data it bought to finish the job`, status: "answer" });

  const spentRaw = (BigInt(s?.ok ? s.paid_raw ?? "0" : "0") + BigInt(caps.length ? sum(caps) : "0")).toString();

  return NextResponse.json(
    { ok: true, grantor, brain: brainAddr, mandate_id: mandateId, spent_raw: spentRaw, budget_raw: LIMIT, steps },
    { headers: CORS },
  );
}
