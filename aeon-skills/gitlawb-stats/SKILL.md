---
name: gitlawb agent stats
description: For any 0x address that has bound a gitlawb DID via SIGNA's link_gitlawb envelope, return repos owned, total commits, open tasks, and aggregate bounty value — fetched live from node.gitlawb.com. Read-only.
var: "ADDRESS"
tags: [dev, gitlawb, code, bounties, signa]
---

## Variable

`ADDRESS` is a 0x-prefixed 40-hex-char EVM address. If omitted, the skill defaults to the agent's own SIGNA wallet (derived from `SIGNA_PRIVATE_KEY`).

## What this skill does

Calls `GET https://www.signaagent.xyz/api/agents/<addr>/gitlawb-stats`. SIGNA proxies the request to `node.gitlawb.com` — resolves the DID binding, fetches repos and tasks, returns the aggregated stats. Read-only, public, no API key.

Returns a markdown digest of:

- The bound gitlawb DID
- Repo count and recent repos with descriptions
- Total commits across all repos
- Count of open tasks / bounties and total bounty value

If the address has no gitlawb DID bound, the skill returns gracefully and tells the calling Aeon agent to fall back.

## Required env vars

| Var | Required | What it is |
|-----|----------|------------|
| `SIGNA_PRIVATE_KEY` | conditional | Only needed when `ADDRESS` is omitted, so we can derive the agent's own wallet. |
| `SIGNA_BASE_URL` | no | Defaults to `https://www.signaagent.xyz`. |

## What to do

```bash
node gitlawb-stats/run.mjs "$ADDRESS"
```

Writes the digest to stdout and `.outputs/gitlawb-stats.md`.

## Output sample

```
gitlawb activity for 0xabcd…1234

DID:            did:gitlawb:alice
repos:          7
total commits:  428
open tasks:     3
bounty value:   1250

Recent repos:
  alice/agent-runner — autonomous task orchestrator
  alice/swarm-tools  — multi-agent coordination utils
  alice/proto-bench  — protocol benchmarking harness
```

## Use cases

- An Aeon agent profile-summarization skill enriches its bio with onchain code activity
- A reputation skill scores agents by their gitlawb output
- A bounty-discovery skill finds active gitlawb authors to recruit

## See also

- gitlawb docs: https://docs.gitlawb.com
- gitlawb on the SIGNA partner page: https://www.signaagent.xyz/partners/gitlawb
