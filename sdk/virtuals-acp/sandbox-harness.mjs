/**
 * Sandbox harness — drives jobs through ACP so the SIGNA evaluator accumulates
 * the successful sandbox transactions it needs to graduate.
 *
 *   node --env-file=.env sandbox-harness.mjs
 *
 * HOW GRADUATION WORKS
 * An agent graduates after ~10 successful sandbox transactions with on-point
 * deliverables, after which the Virtuals team reviews it manually. For an
 * EVALUATOR, "a transaction" means a job on which it was the evaluatorAddress
 * and which reached a terminal state. So a job needs three parties:
 *
 *   test buyer  (this script)  creates + funds the job
 *   test seller (this script)  sets the budget + submits the deliverable
 *   SIGNA evaluator            casts the signed verdict  ← run evaluator.mjs alongside
 *
 * Run `npm start` (evaluator.mjs) in one terminal and this in another. This
 * script never casts the verdict itself — that is the evaluator's job, and the
 * whole point is that its verdict is signed.
 *
 * COSTS REAL VALUE. Each job funds escrow (default 0.1 USDC) on the configured
 * chain, plus gas. Start with JOBS=1 and confirm the full round trip before
 * running the rest.
 */
import { AcpAgent, PrivyAlchemyEvmProviderAdapter, AssetToken } from "@virtuals-protocol/acp-node-v2";
import { base } from "@account-kit/infra";

const required = [
  "ACP_BUYER_WALLET_ADDRESS", "ACP_BUYER_WALLET_ID", "ACP_BUYER_SIGNER_PRIVATE_KEY",
  "ACP_SELLER_WALLET_ADDRESS", "ACP_SELLER_WALLET_ID", "ACP_SELLER_SIGNER_PRIVATE_KEY",
  "ACP_EVALUATOR_WALLET_ADDRESS", "ACP_OFFERING_NAME",
];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing env: ${missing.join(", ")}\nSee README.md — the harness needs a test buyer AND a test seller, plus your evaluator's address.`);
  process.exit(1);
}

const JOBS = Number(process.env.JOBS ?? 1);
const BUDGET = Number(process.env.JOB_BUDGET_USDC ?? 0.1);
const EVALUATOR = process.env.ACP_EVALUATOR_WALLET_ADDRESS;
const OFFERING = process.env.ACP_OFFERING_NAME;

const mk = async (role) =>
  AcpAgent.create({
    provider: await PrivyAlchemyEvmProviderAdapter.create({
      walletAddress: process.env[`ACP_${role}_WALLET_ADDRESS`],
      walletId: process.env[`ACP_${role}_WALLET_ID`],
      signerPrivateKey: process.env[`ACP_${role}_SIGNER_PRIVATE_KEY`],
      chains: [base],
      ...(process.env.ACP_BUILDER_CODE ? { builderCode: process.env.ACP_BUILDER_CODE } : {}),
    }),
  });

const buyer = await mk("BUYER");
const seller = await mk("SELLER");

// The work the test seller submits. It genuinely satisfies the requirement —
// the point is to exercise the evaluator, not to trick it.
const DELIVERABLE =
  "Sentiment read: Base is risk-on, Fear & Greed rising. The opportunity is agentic-commerce infrastructure, " +
  "where volume is compounding fastest. Watch out: liquidity is thin outside the top pairs, so size accordingly. " +
  "Numbers from DefiLlama Base TVL.";

let completed = 0;
let settled = 0;
const done = new Set();

buyer.on("entry", async (session, entry) => {
  if (entry.kind !== "system") return;
  switch (entry.event?.type) {
    case "budget.set":
      await session.fund(AssetToken.usdc(BUDGET, session.chainId));
      console.log(`[buyer]  funded job ${session.jobId} with ${BUDGET} USDC`);
      break;
    case "job.completed":
    case "job.rejected":
      if (done.has(session.jobId)) break;
      done.add(session.jobId);
      settled++;
      if (entry.event.type === "job.completed") completed++;
      console.log(`[buyer]  job ${session.jobId} -> ${entry.event.type}  (${completed} completed / ${settled} settled)`);
      break;
  }
});

seller.on("entry", async (session, entry) => {
  if (entry.kind === "message" && entry.contentType === "requirement" && session.status === "open") {
    await session.setBudget(AssetToken.usdc(BUDGET, session.chainId));
    console.log(`[seller] budget set on job ${session.jobId}`);
    return;
  }
  if (entry.kind === "system" && entry.event?.type === "job.funded") {
    await session.submit(DELIVERABLE);
    console.log(`[seller] submitted deliverable for job ${session.jobId}`);
  }
});

await buyer.start();
await seller.start();

const sellerAddress = await seller.getAddress();
console.log(`[harness] buyer=${await buyer.getAddress()} seller=${sellerAddress} evaluator=${EVALUATOR}`);
console.log(`[harness] running ${JOBS} job(s) at ${BUDGET} USDC each against offering "${OFFERING}"`);
console.log(`[harness] make sure evaluator.mjs is running, or jobs will stall at "submitted"`);

for (let i = 1; i <= JOBS; i++) {
  const jobId = await buyer.createJobByOfferingName(
    base.id,
    OFFERING,
    sellerAddress,
    { key: "Give me a Base market read: sentiment, one opportunity, a risk callout, and a source." },
    { evaluatorAddress: EVALUATOR }, // ← the SIGNA evaluator judges and signs
  );
  console.log(`[harness] created job ${i}/${JOBS}: ${jobId}`);
  await new Promise((r) => setTimeout(r, Number(process.env.JOB_DELAY_MS ?? 15000)));
}

console.log(`[harness] all jobs created. Waiting for settlement — Ctrl+C when done.`);
process.on("SIGINT", async () => {
  console.log(`\n[harness] ${completed} completed / ${settled} settled of ${JOBS}`);
  await buyer.stop();
  await seller.stop();
  process.exit(0);
});
