import { NextRequest, NextResponse } from "next/server";
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, toBytes, getAddress } from "viem";
import { createHash, randomBytes } from "node:crypto";
import { CAPABILITY_CATALOG, fulfillCapability } from "@/lib/capabilities";
import { listRegistered, callRegistered, type RegisteredCapability } from "@/lib/marketplace";
import { spendPreimage, budgetRequestPreimage, USDC_BASE, NETWORK_BASE } from "@/lib/mandate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/brain   { goal: string }   (or GET ?goal=)
 *
 * THE SIGNA BRAIN. An agent's own brain: it reasons on decentralized,
 * provider-agnostic inference (x402-paid in production — the agent signs to
 * pay, holds no API key), and it ACTS through the SIGNA OS — it decides which
 * capabilities on the network to call, invokes them for real, and synthesizes
 * an answer from the live results. A brain with a useful OS, not a chatbot.
 *
 * plan (reason which tools)  ->  act (invoke real capabilities)  ->  answer
 *
 * The brain signs an attestation over (goal, tools, answer) so the output is a
 * verifiable receipt: who produced it, from which real tool results.
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const brain = privateKeyToAccount(keccak256(toBytes("signa:brain:v1")));
// the brain's signed memory log lives at a dedicated archive address (a
// self-DM is rejected, so memory is addressed here — still wallet-signed by
// the brain and re-verifiable by reading this inbox filtered by the brain).
const MEMORY_ARCHIVE = privateKeyToAccount(keccak256(toBytes("signa:brain-memory:v1"))).address.toLowerCase();

async function reason(origin: string, prompt: string): Promise<string> {
  const r = await fetch(`${origin}/api/gateway/respond`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const j = await r.json().catch(() => ({}));
  return (j?.response ?? "").toString().trim();
}

// the brain acts on the network with its own wallet — signed, keyless
function dmPreimage(from: string, to: string, body: string, ts: number) {
  return ["SIGNA agent dm v1", `ts:${ts}`, `from:${from.toLowerCase()}`, `to:${to.toLowerCase()}`, `body:${body}`].join("\n");
}
async function brainSend(origin: string, to: string, body: string): Promise<string | null> {
  const from = brain.address.toLowerCase();
  const ts = Date.now();
  const signature = await brain.signMessage({ message: dmPreimage(from, to, body.slice(0, 8000), ts) });
  try {
    const r = await fetch(`${origin}/api/agents/${from}/dm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ from, to: to.toLowerCase(), body: body.slice(0, 8000), ts, signature }),
    });
    const j = await r.json().catch(() => ({}));
    return j?.dm?.id ?? null;
  } catch {
    return null;
  }
}
async function resolveAddr(origin: string, id: string): Promise<string | null> {
  if (/^0x[a-fA-F0-9]{40}$/.test(id)) return id.toLowerCase();
  try {
    const j = await (await fetch(`${origin}/api/resolve?id=${encodeURIComponent(id)}`)).json();
    return j?.ok && j.address ? j.address : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// METERED COMPUTE — the brain can spend, but only within a human's budget.
//
// The brain runs on paid, decentralized inference; it holds no funds of its own.
// When a human grants it a bounded mandate (agent = the brain's address), the
// brain pays per reasoning run for its own compute: it signs a REAL EIP-3009
// USDC-on-Base authorization -> SIGNA issues a verifiable x402 receipt -> the
// spend is recorded against the mandate, capped per-run and in total. When the
// budget is exhausted the brain STOPS (it won't burn compute it can't pay for)
// and wallet-signs a request for more. The model decides; SIGNA enforces the
// cap and proves the spend. Nothing is broadcast.
const COMPUTE = privateKeyToAccount(keccak256(toBytes("signa:inference:v1"))).address.toLowerCase();
const INFERENCE_PRICE = "10000"; // 0.01 USDC per reasoning run
const TW_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;
// truthful USDC formatting: 2 decimals minimum, but keep sub-cent precision so
// "0.005 left" never rounds up to read like "0.01 left" next to a 0.01 price.
const usd = (raw: string) => {
  try {
    let s = (Number(BigInt(raw)) / 1e6).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
    if (!s.includes(".")) s += ".00";
    else if (s.split(".")[1].length < 2) s += "0";
    return s;
  } catch {
    return raw;
  }
};

type MandateRow = { id: string; grantor: string; agent: string; limit_raw: string; per_tx_raw: string; expiry: number };

async function lookupMandate(origin: string, mandateId: string): Promise<MandateRow | null> {
  try {
    const j = await (await fetch(`${origin}/api/mandates?agent=${brain.address.toLowerCase()}`)).json();
    const list: MandateRow[] = j?.ok ? j.mandates : [];
    return list.find((m) => m.id === mandateId) ?? null;
  } catch {
    return null;
  }
}

// the brain signs a real EIP-3009 USDC auth for its compute -> x402 receipt
async function mintComputeReceipt(origin: string, amount: string): Promise<string | null> {
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const auth = {
      from: brain.address,
      to: COMPUTE as `0x${string}`,
      value: amount,
      validAfter: String(nowSec - 60),
      validBefore: String(nowSec + 3600),
      nonce: ("0x" + randomBytes(32).toString("hex")) as `0x${string}`,
    };
    const signature = await brain.signTypedData({
      domain: { name: "USD Coin", version: "2", chainId: 8453, verifyingContract: USDC_BASE as `0x${string}` },
      types: TW_TYPES,
      primaryType: "TransferWithAuthorization",
      message: {
        from: auth.from, to: auth.to, value: BigInt(auth.value),
        validAfter: BigInt(auth.validAfter), validBefore: BigInt(auth.validBefore), nonce: auth.nonce,
      },
    });
    const r = await (await fetch(`${origin}/api/x402/receipt`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        request: { item: "SIGNA brain inference", buyer_agent: brain.address.toLowerCase() },
        terms: { amount, asset: USDC_BASE, network: NETWORK_BASE, payTo: COMPUTE },
        payment: { ...auth, signature },
        output: { delivered: true, item: "inference" },
      }),
    })).json();
    return r?.ok ? r.receipt.id : null;
  } catch {
    return null;
  }
}

// pay for one reasoning run within the mandate (x402 receipt + capped spend)
async function payForCompute(origin: string, mandateId: string, amount: string, note: string) {
  const receiptId = await mintComputeReceipt(origin, amount);
  const ts = Date.now();
  const signature = await brain.signMessage({
    message: spendPreimage({ ts, mandateId, agent: brain.address.toLowerCase(), amount, note }),
  });
  const r = await (await fetch(`${origin}/api/mandates/spend`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ mandate_id: mandateId, agent: brain.address.toLowerCase(), amount, note, receipt_id: receiptId, ts, signature }),
  })).json();
  return { ...r, receiptId };
}

// build an x402 "exact" payment header: the brain signs an EIP-3009 USDC auth
// to the provider so it can pay for a priced capability through the gateway.
async function buildPaymentHeader(payTo: string, amount: string): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const to = getAddress(payTo);
  const auth = {
    from: brain.address,
    to,
    value: amount,
    validAfter: String(nowSec - 60),
    validBefore: String(nowSec + 3600),
    nonce: ("0x" + randomBytes(32).toString("hex")) as `0x${string}`,
  };
  const signature = await brain.signTypedData({
    domain: { name: "USD Coin", version: "2", chainId: 8453, verifyingContract: USDC_BASE as `0x${string}` },
    types: TW_TYPES,
    primaryType: "TransferWithAuthorization",
    message: {
      from: auth.from, to: auth.to, value: BigInt(auth.value),
      validAfter: BigInt(auth.validAfter), validBefore: BigInt(auth.validBefore), nonce: auth.nonce,
    },
  });
  const payload = { x402Version: 2, scheme: "exact", network: NETWORK_BASE, payload: { signature, authorization: auth } };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

// the brain wallet-signs a request to its grantor for more inference budget
async function askForBudget(origin: string, grantor: string, amount: string, goal: string): Promise<string | null> {
  try {
    const ts = Date.now();
    const signature = await brain.signMessage({
      message: budgetRequestPreimage({ ts, agent: brain.address.toLowerCase(), grantor, amount, goal, reason: "inference budget to keep reasoning" }),
    });
    const r = await (await fetch(`${origin}/api/requests`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent: brain.address.toLowerCase(), grantor, amount, goal, reason: "inference budget to keep reasoning", ts, signature }),
    })).json();
    return r?.ok ? r.request?.id ?? null : null;
  } catch {
    return null;
  }
}

const BUILTIN_DOC = CAPABILITY_CATALOG.map((c) => `- ${c.name}(${c.input === "none" ? "" : "arg"}): ${c.description}`).join("\n");

async function run(goal: string, origin: string, opts: { remember?: boolean; reportTo?: string; mandateId?: string } = {}) {
  // 0. METER — if a human granted the brain a mandate, the brain pays for its
  // own inference before it reasons (pay-before-compute). If the budget is
  // exhausted it does NOT burn compute it can't pay for: it stops and signs a
  // request for more. No mandate => unmetered (the brain runs as before).
  let spend:
    | { ok: true; paid_raw: string; remaining_raw: string; receipt_id: string | null; receipt_url: string | null }
    | { ok: false; error: string; budget_exhausted?: boolean; remaining_raw?: string; request_id?: string | null }
    | null = null;
  if (opts.mandateId) {
    const mandate = await lookupMandate(origin, opts.mandateId);
    if (!mandate) {
      spend = { ok: false, error: "mandate_not_found_for_brain" };
    } else if (Number(mandate.expiry) < Math.floor(Date.now() / 1000)) {
      spend = { ok: false, error: "mandate_expired" };
    } else {
      const paid = await payForCompute(origin, opts.mandateId, INFERENCE_PRICE, `inference: ${goal.slice(0, 56)}`);
      if (paid?.ok) {
        spend = {
          ok: true,
          paid_raw: INFERENCE_PRICE,
          remaining_raw: paid.remaining_raw ?? "0",
          receipt_id: paid.receiptId ?? null,
          receipt_url: paid.receiptId ? `/x402/${paid.receiptId}` : null,
        };
      } else {
        // budget exhausted — stop, and wallet-sign a request for more.
        const remaining = paid?.remaining_raw ?? "0";
        const requestId = await askForBudget(origin, mandate.grantor, "50000", goal.slice(0, 80));
        const ts = Date.now();
        const answer =
          `I've spent the budget you granted me — only ${usd(remaining)} USDC is left and each reasoning run costs ${usd(INFERENCE_PRICE)}. ` +
          `I've wallet-signed a request for 0.05 USDC more so I can keep working. Approve it and I'll finish the job.`;
        const answerHash = createHash("sha256").update(answer).digest("hex");
        const preimage = ["SIGNA brain receipt v1", `ts:${ts}`, `goal:${goal}`, `tools:`, `answer:${answerHash}`].join("\n");
        const signature = await brain.signMessage({ message: preimage });
        return {
          ok: true,
          goal,
          plan: [],
          tools: [],
          answer,
          acts: { memory: null, report: null },
          ts,
          brain: brain.address.toLowerCase(),
          signature,
          verify: { scheme: "eip191", preimage, how: "sha256 the answer, rebuild the preimage, verifyMessage against `brain`" },
          spend: { ok: false as const, error: paid?.error ?? "exceeds_mandate", budget_exhausted: true, remaining_raw: remaining, request_id: requestId },
          note: "The brain runs on paid inference and holds no funds of its own. It stopped because the human-granted budget is exhausted, and wallet-signed a request for more. SIGNA enforces the cap; the model never spends past it.",
        };
      }
    }
  }

  // The brain's toolset = built-in capabilities + community capabilities from
  // the open marketplace. FREE caps are always available. PRICED caps are
  // included ONLY when the brain is funded by a mandate this run — then it can
  // pay for them within the budget (via the x402 gateway, capped + logged).
  // Without a mandate the brain holds no funds, so priced caps stay excluded.
  const funded = !!(spend && spend.ok);
  const mandateId = opts.mandateId;
  const paidCaps: Array<{ cap: string; paid_raw: string; pay_to: string; remaining_raw: string }> = [];
  let registered: RegisteredCapability[] = [];
  try {
    const all = await listRegistered(60);
    registered = (funded ? all : all.filter((r) => !(r.price_usdc > 0))).slice(0, 24);
  } catch { /* marketplace best-effort */ }
  const regByName = new Map(registered.map((r) => [r.name, r] as const));
  const allowed = new Set<string>([...CAPABILITY_CATALOG.map((c) => c.name), ...regByName.keys()]);
  const regDoc = registered
    .map((r) => `- ${r.name}(arg): ${r.description} [community${r.price_usdc > 0 ? `, ${r.price_usdc} USDC` : ""}]`)
    .join("\n");
  const toolsDoc = regDoc ? `${BUILTIN_DOC}\n${regDoc}` : BUILTIN_DOC;

  // record a capped spend against the brain's mandate (enforces the budget)
  const spendFromMandate = async (amount: string, note: string) => {
    const t = Date.now();
    const s = await brain.signMessage({ message: spendPreimage({ ts: t, mandateId: mandateId!, agent: brain.address.toLowerCase(), amount, note }) });
    return (await fetch(`${origin}/api/mandates/spend`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ mandate_id: mandateId, agent: brain.address.toLowerCase(), amount, note, ts: t, signature: s }),
    })).json();
  };

  // unified fulfilment — built-in via the partner adapters, FREE registered via
  // the SSRF-guarded proxy, PRICED registered paid for within the mandate and
  // fetched through the x402 gateway (so the brain never bypasses the price).
  const fulfillAny = async (cap: string, arg: string): Promise<unknown> => {
    if (CAPABILITY_CATALOG.some((c) => c.name === cap)) return fulfillCapability(cap, arg);
    const rec = regByName.get(cap);
    if (!rec) throw new Error(`unknown capability: ${cap}`);
    if (!(rec.price_usdc > 0)) return callRegistered(rec, arg);
    // priced: pay within the mandate, then invoke through the gateway
    if (!funded || !mandateId) throw new Error(`${cap} is priced; the brain needs a mandate to pay for it`);
    const amount = BigInt(Math.round(rec.price_usdc * 1e6)).toString();
    const payTo = (rec.pay_to ?? rec.provider_address).toLowerCase();
    const sp = await spendFromMandate(amount, `cap:${cap}`);
    if (!sp?.ok) throw new Error(`over budget for ${cap}: ${usd(sp?.remaining_raw ?? "0")} USDC left, needs ${usd(amount)}`);
    const header = await buildPaymentHeader(payTo, amount);
    const r = await fetch(`${origin}/api/capabilities/invoke?cap=${encodeURIComponent(cap)}&arg=${encodeURIComponent(arg)}`, { headers: { "x-payment": header } });
    const j = await r.json();
    if (!r.ok || !j?.ok) throw new Error(`paid invoke failed for ${cap}: ${j?.error ?? `HTTP ${r.status}`}`);
    paidCaps.push({ cap, paid_raw: amount, pay_to: payTo, remaining_raw: sp.remaining_raw });
    return j.output;
  };

  // 1. PLAN — the brain decides which real capabilities to call
  const planPrompt =
    `You are the SIGNA Brain. You can call these capabilities to gather REAL live data before answering:\n${toolsDoc}\n\n` +
    `Given the user's goal, output ONLY a compact JSON array of the calls to make, e.g. [{"cap":"root.market","arg":""},{"cap":"bankr.resolve","arg":"@jesse"}]. ` +
    `Use [] if no data is needed. Max 3 calls. No prose.\n\nGoal: ${goal}`;
  let planRaw = "";
  try { planRaw = await reason(origin, planPrompt); } catch { /* gateway hiccup */ }
  let plan: { cap: string; arg?: string }[] = [];
  const m = planRaw.match(/\[[\s\S]*\]/);
  if (m) { try { plan = JSON.parse(m[0]); } catch { plan = []; } }
  plan = (Array.isArray(plan) ? plan : []).filter((p) => p && allowed.has(p.cap)).slice(0, 3);

  // 2. ACT — invoke the chosen capabilities for real (live partner / community data)
  const tools: { cap: string; arg: string; output: unknown; error?: string }[] = [];
  for (const p of plan) {
    try {
      const output = await fulfillAny(p.cap, p.arg ?? "");
      tools.push({ cap: p.cap, arg: p.arg ?? "", output });
    } catch (e) {
      tools.push({ cap: p.cap, arg: p.arg ?? "", output: null, error: e instanceof Error ? e.message : "failed" });
    }
  }

  // 3. SYNTHESIZE — answer from the real results
  const dataBlock = tools.length ? JSON.stringify(tools.map((t) => ({ cap: t.cap, arg: t.arg, output: t.output }))) : "(no tools were needed)";
  const answerPrompt =
    `You are the SIGNA Brain. Answer the user's goal concisely and concretely using ONLY the real data below. ` +
    `If data is present, ground every claim in it. Plain text, no markdown headers.\n\nGoal: ${goal}\n\nReal data: ${dataBlock}`;
  let answer = "";
  try { answer = await reason(origin, answerPrompt); } catch { /* */ }
  if (!answer) answer = tools.length ? "The brain gathered live data (see tools) but the reasoning step is momentarily unavailable." : "The brain is momentarily unavailable.";

  // 4. SIGN — a verifiable brain receipt
  const ts = Date.now();
  const answerHash = createHash("sha256").update(answer).digest("hex");
  const preimage = ["SIGNA brain receipt v1", `ts:${ts}`, `goal:${goal}`, `tools:${tools.map((t) => t.cap).join(",")}`, `answer:${answerHash}`].join("\n");
  const signature = await brain.signMessage({ message: preimage });

  // 5. ACT ON THE NETWORK — remember what it learned, report to another agent.
  // A full autonomous cycle: reason -> act -> remember -> message, all signed.
  const acts: { memory: string | null; report: { to: string; dm_id: string | null } | null } = { memory: null, report: null };
  if (opts.remember) {
    acts.memory = await brainSend(origin, MEMORY_ARCHIVE, `mem:${goal.slice(0, 80)}\t${answer}`);
  }
  if (opts.reportTo) {
    const to = await resolveAddr(origin, opts.reportTo);
    if (to) acts.report = { to, dm_id: await brainSend(origin, to, `[brain report] ${answer}`) };
  }

  const capsPaidRaw = paidCaps.reduce((s, c) => s + BigInt(c.paid_raw), 0n).toString();
  const note = spend?.ok
    ? `This run was paid from a bounded mandate: ${usd(INFERENCE_PRICE)} USDC for inference` +
      `${spend.receipt_id ? ` (x402 receipt ${spend.receipt_id})` : ""}` +
      `${paidCaps.length ? ` + ${usd(capsPaidRaw)} USDC for ${paidCaps.length} priced capabilit${paidCaps.length === 1 ? "y" : "ies"} (${paidCaps.map((c) => c.cap).join(", ")})` : ""}. ` +
      `The brain holds no funds of its own — a human granted the budget; SIGNA enforced the per-tx + total caps and proved every spend. The model decides; it cannot spend past the cap.`
    : "The brain reasons on decentralized inference, acts through the SIGNA capability mesh, and can remember + message other agents — all wallet-signed. Tool outputs are real, live partner data. In production the agent pays per inference via x402 and holds no API key.";

  return {
    ok: true,
    goal,
    plan: plan.map((p) => `${p.cap}(${p.arg ?? ""})`),
    tools,
    answer,
    acts,
    ts,
    brain: brain.address.toLowerCase(),
    signature,
    verify: { scheme: "eip191", preimage, how: "sha256 the answer, rebuild the preimage, verifyMessage against `brain`" },
    spend,
    paid_caps: paidCaps,
    note,
  };
}

export async function POST(req: NextRequest) {
  let goal = "", remember = false, reportTo = "", mandateId = "";
  try { const b = await req.json(); goal = b?.goal ?? ""; remember = !!b?.remember; reportTo = b?.report_to ?? b?.reportTo ?? ""; mandateId = b?.mandate_id ?? b?.mandateId ?? ""; } catch { /* */ }
  if (!goal || goal.length < 2) return NextResponse.json({ ok: false, error: "missing_goal" }, { status: 400, headers: CORS });
  if (goal.length > 600) return NextResponse.json({ ok: false, error: "goal_too_long" }, { status: 400, headers: CORS });
  try {
    return NextResponse.json(await run(goal, req.nextUrl.origin, { remember, reportTo: reportTo || undefined, mandateId: mandateId || undefined }), { headers: CORS });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "brain error" }, { status: 502, headers: CORS });
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const goal = sp.get("goal") ?? "";
  const remember = sp.get("remember") === "1" || sp.get("remember") === "true";
  const reportTo = sp.get("report_to") ?? "";
  const mandateId = sp.get("mandate_id") ?? "";
  if (!goal || goal.length < 2) return NextResponse.json({ ok: false, error: "missing_goal", hint: "?goal=what is the base market doing&report_to=@handle&remember=1&mandate_id=<uuid>" }, { status: 400, headers: CORS });
  try {
    return NextResponse.json(await run(goal, req.nextUrl.origin, { remember, reportTo: reportTo || undefined, mandateId: mandateId || undefined }), { headers: CORS });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "brain error" }, { status: 502, headers: CORS });
  }
}
