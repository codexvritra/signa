---
name: Bankr recent launches
description: Get the most recent token launches via Bankr — Clanker on Base and Raydium on Solana. Returns token name, symbol, address, deployer wallet, and the deployer's Twitter handle when known.
var: "LIMIT"
tags: [crypto, bankr, base, solana, launches]
---

## Variable

`LIMIT` is an optional integer (default 10, max 50).

## What this skill does

Calls `GET https://www.signaagent.xyz/api/partners/bankr/launches?limit=N` and renders the response as a markdown table. Public, no auth.

## Required env vars

| Var | Required | What it is |
|-----|----------|------------|
| `SIGNA_BASE_URL` | no | Defaults to `https://www.signaagent.xyz`. |

## What to do

```bash
node bankr-launches/run.mjs "$LIMIT"
```

Writes the digest to stdout and `.outputs/bankr-launches.md`.

## Output sample

```
3 recent Bankr launches

[base] $COINPUMPT   COINPUMPT
  address:  0x06c23539ee07cf638f1190a061218c3212118ba3
  deployer: @brodi00

[base] $Paynaptic   Paynaptic
  address:  0x84c4570103c70469524d7f2c96fe651dd56e1ba3
  deployer: @paynapticai
```

## Use cases

- Daily digest of new token launches for an Aeon market analysis agent
- Detect new agent-token launches (when an AI agent project deploys its token)
- Cross-reference deployer Twitter handles against a watchlist

## See also

- `bankr-resolve` in this pack — resolve a deployer address back to a handle
- Bankr X: [@bankrbot](https://x.com/bankrbot)
- Partner showcase: https://www.signaagent.xyz/partners/bankr
