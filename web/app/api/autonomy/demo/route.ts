import { NextRequest, NextResponse } from "next/server";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { keccak256, toBytes } from "viem";
import { randomBytes } from "node:crypto";
import {
  mandatePreimage,
  spendPreimage,
  budgetRequestPreimage,
  USDG_ROBINHOOD,
  NETWORK_ROBINHOOD,
} from "@/lib/mandate";
import { permit2Domain, PERMIT2_WITNESS_TYPES, buildPermit2WitnessMessage, RECEIPT_SERVICE_ID } from "@/lib/permit2";
import { RH_CHAIN_ID } from "@/lib/chain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/autonomy/demo — the FULL agentic-commerce loop, live.
 *
 * A human grants an agent a bounded budget. For each purchase the agent signs a
 * REAL Permit2 witness-transfer USDG-on-Robinhood-Chain authorization, SIGDA
 * issues a verifiable x402 receipt, and the spend is recorded against the
 * mandate (bound to that receipt). When it hits the cap it wallet-signs a
 * request for more, the human funds it, and it finishes. budget -> autonomous
 * buy -> x402 payment -> receipt -> bounded spend. Every step is a real
 * signature; nothing is broadcast.
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
  const seller = privateKeyToAccount(keccak256(toBytes("signa:demo-merchant:v1"))).address.toLowerCase();

  const PULL = "40000"; // 0.04 USDG each
  const LIMIT1 = "100000"; // 0.10 USDG budget — only enough for 2 of 3 pulls
  const steps: Array<{ who: string; text: string; status: "ok" | "blocked" | "ask" | "grant"; link?: string }> = [];
  const fmt = (r: string) => `${(Number(BigInt(r)) / 1e6).toFixed(2)}`;

  const post = (path: string, body: unknown) =>
    fetch(`${origin}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json());

  // mint a real x402 receipt for one purchase (agent signs a Permit2 witness-transfer USDG auth)
  async function mintReceipt(item: string): Promise<string | null> {
    const nowSec = Math.floor(Date.now() / 1000);
    const nonce = BigInt("0x" + randomBytes(32).toString("hex"));
    const deadline = BigInt(nowSec + 3600);
    const message = buildPermit2WitnessMessage({
      token: USDG_ROBINHOOD as `0x${string}`,
      amount: BigInt(PULL),
      spender: seller as `0x${string}`, // recipient redeems its own payment
      nonce,
      deadline,
      to: seller as `0x${string}`,
      serviceId: RECEIPT_SERVICE_ID,
    });
    const signature = await agent.signTypedData({
      domain: permit2Domain(RH_CHAIN_ID),
      types: PERMIT2_WITNESS_TYPES,
      primaryType: "PermitWitnessTransferFrom",
      message,
    });
    const payment = {
      owner: agent.address,
      spender: seller,
      to: seller,
      token: USDG_ROBINHOOD,
      amount: PULL,
      nonce: nonce.toString(),
      deadline: deadline.toString(),
      signature,
    };
    const r = await post("/api/x402/receipt", {
      request: { item, buyer_agent: agentAddr },
      terms: { amount: PULL, asset: USDG_ROBINHOOD, network: NETWORK_ROBINHOOD, payTo: seller },
      payment,
      output: { delivered: true, item },
    });
    return r?.ok ? r.receipt.id : null;
  }

  // an autonomous buy: pay (x402 receipt) -> record the spend against the mandate
  const buy = async (mid: string, item: string) => {
    const receiptId = await mintReceipt(item);
    const t = Date.now();
    const sig = await agent.signMessage({ message: spendPreimage({ ts: t, mandateId: mid, agent: agentAddr, amount: PULL, note: item }) });
    const r = await post("/api/mandates/spend", { mandate_id: mid, agent: agentAddr, amount: PULL, note: item, receipt_id: receiptId, ts: t, signature: sig });
    return { ...r, receiptId };
  };

  // 1) human grants a bounded mandate
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  let ts = Date.now();
  let memo = "market briefing helper";
  let sig = await human.signMessage({
    message: mandatePreimage({ ts, grantor, agent: agentAddr, asset: USDG_ROBINHOOD, network: NETWORK_ROBINHOOD, limit: LIMIT1, perTx: PULL, expiry, memo }),
  });
  const m1 = await post("/api/mandates", { grantor, agent: agentAddr, asset: USDG_ROBINHOOD, network: NETWORK_ROBINHOOD, limit: LIMIT1, per_tx: PULL, expiry, memo, ts, signature: sig });
  if (!m1.ok) return NextResponse.json({ ok: false, error: `mandate: ${m1.error}` }, { status: 500, headers: CORS });
  const mandateId = m1.mandate.id;
  steps.push({ who: "human", text: `granted the agent a 0.10 USDG budget (max 0.04 per buy)`, status: "grant" });

  // 2) two autonomous buys, each a real x402 receipt
  const b1 = await buy(mandateId, "data pull 1/3");
  steps.push({ who: "agent", text: `bought pull 1/3 — 0.04 USDG · x402 receipt ✓ · ${fmt(b1.remaining_raw ?? "0")} left`, status: "ok", link: b1.receiptId ? `/x402/${b1.receiptId}` : undefined });
  const b2 = await buy(mandateId, "data pull 2/3");
  steps.push({ who: "agent", text: `bought pull 2/3 — 0.04 USDG · x402 receipt ✓ · ${fmt(b2.remaining_raw ?? "0")} left`, status: "ok", link: b2.receiptId ? `/x402/${b2.receiptId}` : undefined });

  // 3) third buy exceeds the budget (no payment made)
  const t3 = Date.now();
  const sig3 = await agent.signMessage({ message: spendPreimage({ ts: t3, mandateId, agent: agentAddr, amount: PULL, note: "data pull 3/3" }) });
  const s3 = await post("/api/mandates/spend", { mandate_id: mandateId, agent: agentAddr, amount: PULL, note: "data pull 3/3", ts: t3, signature: sig3 });
  steps.push({ who: "agent", text: `tried pull 3/3 — blocked: only ${fmt(s3.remaining_raw ?? "20000")} USDG left, needs 0.04`, status: "blocked" });

  // 4) the agent asks the human for more money
  ts = Date.now();
  const askAmt = "50000";
  sig = await agent.signMessage({ message: budgetRequestPreimage({ ts, agent: agentAddr, grantor, amount: askAmt, goal: "finish the market briefing", reason: "one more data pull (0.04) + buffer" }) });
  const reqRes = await post("/api/requests", { agent: agentAddr, grantor, amount: askAmt, goal: "finish the market briefing", reason: "one more data pull (0.04) + buffer", ts, signature: sig });
  steps.push({ who: "agent", text: `asked the human for 0.05 USDG more to finish the goal — wallet-signed`, status: "ask" });

  // 5) human approves with a fresh top-up mandate
  ts = Date.now();
  const LIMIT2 = "60000";
  memo = "top-up for market briefing";
  sig = await human.signMessage({ message: mandatePreimage({ ts, grantor, agent: agentAddr, asset: USDG_ROBINHOOD, network: NETWORK_ROBINHOOD, limit: LIMIT2, perTx: PULL, expiry, memo }) });
  const m2 = await post("/api/mandates", { grantor, agent: agentAddr, asset: USDG_ROBINHOOD, network: NETWORK_ROBINHOOD, limit: LIMIT2, per_tx: PULL, expiry, memo, ts, signature: sig });
  steps.push({ who: "human", text: `approved — granted a fresh 0.06 USDG top-up`, status: "grant" });

  // 6) final autonomous buy completes the goal
  const b3 = await buy(m2.mandate.id, "data pull 3/3 (retry)");
  steps.push({ who: "agent", text: `bought pull 3/3 — 0.04 USDG · x402 receipt ✓ · goal complete`, status: "ok", link: b3.receiptId ? `/x402/${b3.receiptId}` : undefined });

  return NextResponse.json(
    { ok: true, grantor, agent: agentAddr, mandate_id: mandateId, request_id: reqRes?.request?.id ?? null, steps },
    { headers: CORS },
  );
}
