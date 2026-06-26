---
name: Verifiable B20 tokens (SIGNA × Base)
description: Give this agent the full verifiable toolkit for B20 — Base's native token standard (Beryl upgrade). It can launch a B20 token, pay with an unforgeable note (transferWithMemo), and publish a stablecoin reserve attestation anyone can re-check — every action wallet-signed (EIP-191) and re-verifiable. SIGNA never custodies funds; the agent's own wallet broadcasts, SIGNA proves the action. Use when an agent needs to launch, pay with, or attest a B20 token on Base.
var: "INPUT"
tags: [b20, base, stablecoin, token-launch, payments, agentic-commerce, verifiable]
---

## Why this exists

B20 is Base's chain-native token standard: ~50% cheaper transfers, far cheaper
creation, fully ERC-20 compatible. It has three powers most builders haven't
touched yet — and SIGNA makes each one **provable**:

- **Launch** a B20 token and get a wallet-signed launch receipt binding the
  creator + terms + the deterministic address. *x402 moved the money, B20 mints
  the token, SIGNA proves who launched what.*
- **Pay** with `transferWithMemo` — a transfer carries a 32-byte memo on-chain.
  SIGNA makes that memo a commitment to a note the payer signs, so the money
  proves who paid and why. *On B20, money can talk.*
- **Attest reserves** — a B20 stablecoin issuer publishes a timestamped, signed
  reserve statement anyone can verify (provenance of the claim, not an audit).
  *A stablecoin that can prove its own backing.*

SIGNA never holds funds. The agent's wallet broadcasts each on-chain action; SIGNA
returns the calldata + a re-verifiable signed receipt.

## Variable

`INPUT` is a JSON object selecting the action:

```jsonc
// read any B20 token
{ "action": "info", "address": "0x…" }

// prepare a verifiable B20 launch (your wallet broadcasts the returned calldata)
{ "action": "launch", "name": "My Token", "symbol": "MYT", "variant": "ASSET", "decimals": 18 }
// stablecoin variant:
{ "action": "launch", "name": "My USD", "symbol": "MUSD", "variant": "STABLECOIN", "currency": "USD" }

// pay with an unforgeable note (amount in raw base units)
{ "action": "pay", "token": "0x…", "to": "0x…", "amount": "1000000", "note": "invoice #42 — paid in full" }

// publish a stablecoin reserve attestation
{ "action": "reserves", "token": "0x…", "amount": "1000000.00", "asset": "USDC", "statement": "Backed 1:1 by USDC in a segregated Base wallet." }

// re-verify any SIGNA B20 artifact (kinds: b20_launch, b20_memo, b20_reserves)
{ "action": "verify", "artifact": { "kind": "b20_memo", "…": "…", "signature": "0x…" } }
```

## Required env vars

| Var | Required | What it is |
|-----|----------|------------|
| `SIGNA_PRIVATE_KEY` | yes | The agent's wallet — signs notes + attestations and is the creator/payer/issuer (EIP-191). |
| `SIGNA_BASE_URL` | no | Defaults to `https://www.signaagent.xyz`. |

## What to do

```bash
node signa-b20/run.mjs "$INPUT"
```

Writes the result to stdout and `.outputs/signa-b20.md`. For `launch` and `pay`,
the returned `to` + calldata are broadcast by the agent's own wallet (SIGNA never
moves funds). For `pay` and `reserves`, the skill signs the canonical preimage and
re-verifies it for you, so you get the recovered signer back immediately.

## Works in any framework

This skill is just a wallet + the public SIGNA B20 endpoints, so it drops into any
agent that holds a key — **Aeon** (this pack), **Bankr** (the `signa` skill exposes the
same B20 endpoints), and **MiroShark** (a swarm sim can have its agents launch, pay, and
attest B20 tokens, every move re-verifiable in the verdict). One skill, every framework.

## Verify

Every artifact is an EIP-191 signature anyone can re-check with viem, or via
`POST https://www.signaagent.xyz/api/verify` over the canonical preimage —
kinds `b20_launch`, `b20_memo`, `b20_reserves`. See it live at
<https://www.signaagent.xyz/b20>.
