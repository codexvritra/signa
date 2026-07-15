# SIGNA Verifiable Evaluator — Virtuals ACP

A runnable [Virtuals ACP](https://whitepaper.virtuals.io/about-virtuals/agent-commerce-protocol-acp)
evaluator agent whose every verdict is **signed and bound to the exact deliverable it judged**.

## Why

ACP already proves the **agreement**: the negotiation phase produces a Proof of Agreement,
both agents cryptographically signing identical terms. That part works.

It does not prove the **evaluator** — the agent that decides whether work met those terms,
and therefore whether escrow releases. Virtuals' own documentation concedes it:

> the protocol assumes evaluators act honestly — a documented limitation requiring
> future governance solutions for evaluator accountability

And look at what an evaluator actually casts:

```js
await session.complete("Looks good");
```

Free text, bound to nothing. It doesn't prove which bytes were judged. An evaluator can
approve deliverable X and later claim it saw Y. Nobody can audit it.

This agent asks SIGNA to sign the verdict — binding job → terms → deliverable → verdict →
reasoning into one EIP-191 envelope — **before** casting it, then passes the proof into ACP's
own record via the `reason` string. Anyone can then:

1. **Recover the signature** → this evaluator really made this call. It cannot deny it.
2. **Re-hash the deliverable** → this is the artifact it judged. Swap one byte and verification fails.

```bash
curl -X POST https://www.signaagent.xyz/api/verify \
  -H 'content-type: application/json' \
  -d '{ ...evaluation, "kind": "acp_evaluation" }'
```

Live demo and the attack cases (swap, forge): <https://www.signaagent.xyz/acp>

**Accountability, not comprehension.** SIGNA does not claim to understand the work. Your model
decides and SIGNA notarises it (`method: "declared"`), or you pass concrete `required_elements`
for a deterministic check anyone can re-run (`method: "elements"`). With neither, a keyword
heuristic runs and is flagged `method: "rubric"` so it is never mistaken for understanding.
SIGNA holds no escrow and moves no funds.

## Register (do this first — it needs your wallet)

Registration is a portal + wallet flow, so it has to be done by a human. Order matters:

1. **Register the agent** at <https://app.virtuals.io/acp/new>. Choose the **Evaluator** role
   — "agents that review and verify deliverables submitted by provider agents". (Buyer agents
   can't offer services; only provider/hybrid define service offerings.)
2. **Whitelist your developer wallet (EOA)** as the controller. This is what signs ACP *memos*
   — the lightweight approvals that move a job forward.
3. **Add a signer**: on your agent page (<https://app.virtuals.io/acp/agents/>) open the
   **Signers** tab → **+ Add Signer** → **Copy Key**. That is `ACP_SIGNER_PRIVATE_KEY`.
   Your `walletId` is on the same page.
4. *(Optional, recommended)* grab your **builderCode** (`bc-...`) from the **Settings** tab —
   a [Base builder code](https://docs.base.org/apps/builder-codes/builder-codes) that attributes
   this SDK's transactions to you on base.dev.
5. **Sandbox.** During beta every agent starts in the Sandbox state — safe to test, not publicly
   exposed.
6. **Graduate.** After **10 successful sandbox transactions** with on-point deliverables and a
   good completion rate, a "Congratulations" modal appears with **Proceed to Graduation** (or use
   **Graduate Agent** on the profile page) and a submission form. **Every graduation request is
   manually reviewed by the Virtuals team** before the agent is featured in the production
   visualizer.

> Keep the signer key in `.env` only. Never paste it into chat, a screenshot, a commit, or a
> support ticket. Nobody legitimate will ever ask you for it.

### Profile copy (paste this in)

**Name:** `SIGNA Verifiable Evaluator`

**Role:** Evaluator

**Description:**

> Evaluates ACP deliverables and signs every verdict. ACP's Proof of Agreement already binds both
> agents to identical terms; this evaluator closes the next gap — its verdict is an EIP-191
> signature binding the job, the agreed terms, a hash of the exact deliverable, the verdict and
> the reasoning. Anyone can recover the signature to confirm the evaluator made the call, and
> re-hash the deliverable to confirm which artifact was judged; change one byte and verification
> fails. Accountability, not comprehension: the judgement can come from your own model and be
> notarised, or from a deterministic element check anyone can re-run. Holds no escrow, moves no
> funds, and fails closed — if it cannot verify, it casts no verdict. Verify any verdict at
> signaagent.xyz/acp

**Short pitch:** `Signed, deliverable-bound verdicts. The evaluator that can't deny or swap its calls.`

## Farm the graduation transactions

`sandbox-harness.mjs` drives jobs end-to-end so the evaluator accumulates settled jobs. A job
needs three parties, so the harness plays buyer **and** seller while your evaluator judges:

| party | who runs it | does |
| --- | --- | --- |
| test buyer | `sandbox-harness.mjs` | creates the job with `evaluatorAddress` = your evaluator, funds escrow |
| test seller | `sandbox-harness.mjs` | sets the budget, submits the deliverable |
| SIGNA evaluator | `evaluator.mjs` | casts the **signed** verdict |

So you need **three registered agents** (evaluator + test buyer + test seller). Then:

```bash
npm start                                  # terminal 1 — the evaluator
node --env-file=.env sandbox-harness.mjs   # terminal 2 — buyer + seller
```

**It spends real value.** Each job funds escrow (`JOB_BUDGET_USDC`, default 0.1) plus gas.
`JOBS=1` first — confirm one full round trip (created → budget set → funded → submitted →
signed verdict → completed) before raising it. Jobs stall at `submitted` if the evaluator
isn't running.

## Run

```bash
cp .env.example .env    # fill in from the steps above
npm install
npm start
```

The agent listens for `job.submitted`, asks SIGNA for a signed verdict bound to that
deliverable, and casts `session.complete(reason)` / `session.reject(reason)` with the proof
inside the reason.

**It fails closed.** If SIGNA is unreachable it casts *no* verdict rather than approving
unverified work — an approval releases escrow, so a wrong `complete` is the one irreversible
mistake an evaluator must not make.

## Files

| file | what |
| --- | --- |
| `evaluator.mjs` | the agent — `agent.on("entry")` → signed verdict → complete/reject |
| `.env.example` | config template (wallet, walletId, signer key, builder code) |

Requires Node 20+ (`--env-file`). Peer deps `viem` and `@account-kit/infra` come from the ACP SDK.

Not affiliated with Virtuals Protocol.
