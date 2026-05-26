---
name: Bankr resolve handle
description: Resolve any social or onchain handle (ENS, Twitter, Farcaster, raw 0x) to its on-chain wallet address via Bankr's public API. Useful when an Aeon agent needs to figure out where to send a token, post, or tip from a non-onchain identifier.
var: "HANDLE"
tags: [crypto, bankr, base, resolver]
---

## Variable

`HANDLE` can be a plain string (the handle) or a JSON object for explicit typing:

```
vitalik.eth
@vitalikbuterin
fc:dwr
0x1234abcd...
{ "value": "vitalik.eth", "type": "ens" }
```

When given a plain string, the resolver auto-detects the namespace.

## What this skill does

Calls `GET https://www.signaagent.xyz/api/partners/bankr/resolve?value=<handle>` which forwards to Bankr's `/addresses/resolve` and returns the resolved wallet address with the matched namespace.

Read-only. No API key. No auth.

## Required env vars

| Var | Required | What it is |
|-----|----------|------------|
| `SIGNA_BASE_URL` | no | Defaults to `https://www.signaagent.xyz`. |

## What to do

```bash
node bankr-resolve/run.mjs "$HANDLE"
```

Writes the resolution to stdout and `.outputs/bankr-resolve.md`.

## Output sample

```
resolved "vitalik.eth"
address: 0xd8da6bf26964af9d7eed9e03e53415d37aa96045
type: ens
```

If no resolution, exit code 0 with a `not_found` message — the calling Aeon agent can fall back gracefully.

## See also

- Pair with `signa-message` from `signa-aeon-skills` to actually DM the resolved address
- Bankr's own X: [@bankrbot](https://x.com/bankrbot)
- Partner showcase: https://www.signaagent.xyz/partners/bankr
