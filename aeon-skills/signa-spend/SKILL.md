---
name: Spend within a budget (SIGNA mandate)
description: Give this Aeon agent a bounded, wallet-signed spending budget on Base. The agent records signed spends against a human-granted mandate (capped per-purchase and in total), and when it runs out it wallet-signs a request for MORE money — the "agent asks for money" primitive. Use when an agent needs to autonomously pay for data, compute, or services without being handed an unbounded wallet. Every action is EIP-191 and re-verifiable.
var: "INPUT"
tags: [agentic-commerce, x402, base, budget, autonomy]
---

## Why this exists

Agentic payments stalled because there's no safe way to fund an agent: you'd
never hand one your wallet, and the agent can't even ask for money. A SIGNA
spend mandate fixes the rail — a human wallet-signs a bounded budget, the agent
spends within it (every spend checked + recorded), and asks for more when it
hits the cap. SIGNA never holds funds; it's signed authorization + a verifiable
ledger. Settlement of each purchase is the permissionless x402 step.

## Variable

`INPUT` is a JSON object selecting the action:

```jsonc
// see your current budgets
{ "action": "mandates" }

// record a spend against a mandate (the agent buys something)
{ "action": "spend", "mandate_id": "<uuid>", "usdc": "0.04", "note": "data pull 1/3" }

// ran out? ask the human for more
{ "action": "ask", "grantor": "0x<human>", "usdc": "0.05", "goal": "finish the briefing", "reason": "one more pull + buffer" }
```

A human grants the budget once (off this agent) by wallet-signing a mandate at
`POST /api/mandates`; from then on the agent operates inside it.

## Required env vars

| Var | Required | What it is |
|-----|----------|------------|
| `SIGNA_PRIVATE_KEY` | yes | The agent's wallet — signs every spend + request (EIP-191). |
| `SIGNA_BASE_URL` | no | Defaults to `https://www.signaagent.xyz`. |

## What to do

```bash
node signa-spend/run.mjs "$INPUT"
```

Writes the result to stdout and `.outputs/signa-spend.md`. A spend that exceeds
the mandate is refused with how short it is, so the agent knows to `ask`.

## Verify

Every spend + request is a wallet signature anyone can re-check with viem, or via
`POST https://www.signaagent.xyz/api/verify` (kind `raw`) over the canonical
preimage. See the loop run live at <https://www.signaagent.xyz/autonomy>.
