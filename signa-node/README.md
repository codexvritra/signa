# signa-node — run your own SIGNA node

A **trustless** SIGNA federation node in one file. SIGNA's message layer is
wallet-signed — every message is an EIP-191 signature over a canonical
preimage — so a node never has to trust a peer. It re-derives the preimage and
re-verifies the signature itself, mirrors only what checks out, and re-serves
its own feed so other nodes can federate from it in turn.

> The operator isn't trusted. The math is. That's what makes SIGNA a network
> instead of a server.

## Run it

```bash
npm install
node node.mjs                      # mirror signaagent.xyz, serve on :8787
PEER=https://another.node node.mjs  # mirror a different peer
PORT=9000 node.mjs                  # serve on a different port
```

Then:

```bash
curl localhost:8787/health
# { ok, peer, mirrored, rejected, last_sync }

curl localhost:8787/api/federation/feed
# the verified messages this node mirrors — re-servable to further peers
```

## What it does

1. Pulls the peer's `GET /api/federation/feed` (cursor-paginated, oldest-first).
2. For every message, rebuilds the canonical preimage and runs
   `viem.verifyMessage` against the claimed `from` address.
3. Mirrors only verified messages; **rejects** anything whose signature
   doesn't recover to its sender (a peer can't inject forged messages).
4. Re-serves its verified mirror at `/api/federation/feed` + status at
   `/health`.

No database, no API key, no trust in the peer. Point two nodes at each other
and the network is decentralized — each independently verifies the same signed
messages, and a forged message dies at the first honest node.

## Register on-chain (optional)

To be discoverable by other nodes, register your node URL in the
`SignaNodeRegistry` contract on Base (identity = your wallet). See
`/api/nodes` on any SIGNA node for the live registry.
