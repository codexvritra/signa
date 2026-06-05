import { NextRequest, NextResponse } from "next/server";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import {
  mandatePreimage,
  spendPreimage,
  budgetRequestPreimage,
  USDC_BASE,
  NETWORK_BASE,
} from "@/lib/mandate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/autonomy/demo — run the full agent-funding loop live.
 *
 * A human grants an agent a bounded budget. The agent pursues a goal that needs
 * three paid data pulls, spends within budget, hits the cap, and WALLET-SIGNS A
 * REQUEST FOR MORE MONEY — the primitive the Base agentic-commerce debate says
 * doesn't exist. The human funds it (a new mandate), the agent finishes. Every
 * step is a real EIP-191 signature against the live APIs. Nothing is broadcast.
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const human = privateKeyToAccount(generatePrivateKey());
  const agent = privateKeyToAccount(generatePrivateKey());
  const grantor = human.address.toLowerCase();
  const agentAddr = agent.address.toLowerCase();

  const PULL = "40000"; // 0.04 USDC each
  const LIMIT1 = "100000"; // 0.10 USDC budget — only enough for 2 of 3 pulls
  const steps: Array<{ who: string; text: string; status: "ok" | "blocked" | "ask" | "grant" }> = [];

  const post = (path: string, body: unknown) =>
    fetch(`${origin}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json());

  // 1) human grants a bounded mandate
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  let ts = Date.now();
  let memo = "market briefing helper";
  let sig = await human.signMessage({
    message: mandatePreimage({ ts, grantor, agent: agentAddr, asset: USDC_BASE, network: NETWORK_BASE, limit: LIMIT1, perTx: PULL, expiry, memo }),
  });
  const m1 = await post("/api/mandates", {
    grantor, agent: agentAddr, asset: USDC_BASE, network: NETWORK_BASE, limit: LIMIT1, per_tx: PULL, expiry, memo, ts, signature: sig,
  });
  if (!m1.ok) return NextResponse.json({ ok: false, error: `mandate: ${m1.error}` }, { status: 500, headers: CORS });
  const mandateId = m1.mandate.id;
  steps.push({ who: "human", text: `granted the agent a 0.10 USDC budget (max 0.04 per buy)`, status: "grant" });

  // helper: agent spends a pull
  const spend = async (mid: string, note: string) => {
    const t = Date.now();
    const s = await agent.signMessage({ message: spendPreimage({ ts: t, mandateId: mid, agent: agentAddr, amount: PULL, note }) });
    return post("/api/mandates/spend", { mandate_id: mid, agent: agentAddr, amount: PULL, note, ts: t, signature: s });
  };

  // 2) agent buys pulls 1 and 2 (within budget)
  const s1 = await spend(mandateId, "data pull 1/3");
  steps.push({ who: "agent", text: `bought data pull 1/3 — 0.04 USDC · ${(Number(BigInt(s1.remaining_raw ?? "0")) / 1e6).toFixed(2)} left`, status: "ok" });
  const s2 = await spend(mandateId, "data pull 2/3");
  steps.push({ who: "agent", text: `bought data pull 2/3 — 0.04 USDC · ${(Number(BigInt(s2.remaining_raw ?? "0")) / 1e6).toFixed(2)} left`, status: "ok" });

  // 3) third pull exceeds the budget
  const s3 = await spend(mandateId, "data pull 3/3");
  steps.push({ who: "agent", text: `tried pull 3/3 — blocked: only ${(Number(BigInt(s3.remaining_raw ?? "20000")) / 1e6).toFixed(2)} USDC left, needs 0.04`, status: "blocked" });

  // 4) THE PRIMITIVE: the agent asks the human for more money
  ts = Date.now();
  const askAmt = "50000"; // 0.05 USDC
  sig = await agent.signMessage({
    message: budgetRequestPreimage({ ts, agent: agentAddr, grantor, amount: askAmt, goal: "finish the market briefing", reason: "one more data pull (0.04) + buffer" }),
  });
  const reqRes = await post("/api/requests", { agent: agentAddr, grantor, amount: askAmt, goal: "finish the market briefing", reason: "one more data pull (0.04) + buffer", ts, signature: sig });
  steps.push({ who: "agent", text: `asked the human for 0.05 USDC more to finish the goal — wallet-signed`, status: "ask" });

  // 5) human approves by granting a fresh, larger mandate
  ts = Date.now();
  const LIMIT2 = "60000"; // a fresh 0.06 mandate, enough for the last pull
  memo = "top-up for market briefing";
  sig = await human.signMessage({
    message: mandatePreimage({ ts, grantor, agent: agentAddr, asset: USDC_BASE, network: NETWORK_BASE, limit: LIMIT2, perTx: PULL, expiry, memo }),
  });
  const m2 = await post("/api/mandates", { grantor, agent: agentAddr, asset: USDC_BASE, network: NETWORK_BASE, limit: LIMIT2, per_tx: PULL, expiry, memo, ts, signature: sig });
  steps.push({ who: "human", text: `approved — granted a fresh 0.06 USDC top-up`, status: "grant" });

  // 6) agent finishes the goal on the new mandate
  const s4 = await spend(m2.mandate.id, "data pull 3/3 (retry)");
  steps.push({ who: "agent", text: `bought data pull 3/3 — goal complete ✓ (${(Number(BigInt(s4.remaining_raw ?? "0")) / 1e6).toFixed(2)} left)`, status: "ok" });

  return NextResponse.json(
    {
      ok: true,
      grantor,
      agent: agentAddr,
      mandate_id: mandateId,
      request_id: reqRes?.request?.id ?? null,
      steps,
    },
    { headers: CORS },
  );
}
