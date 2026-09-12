# Deploying SignaRoomRegistry to Robinhood Chain mainnet

The `SignaRoomRegistry` contract is the trust-minimization layer for SIGNA Rooms (v0.51). Once deployed, any room creator can anchor their room's signed manifest hash on-chain — federated nodes can then verify the room's identity without trusting our server.

## Prerequisites

- Foundry installed (`forge --version`)
- A deployer wallet with ~0.0002 ETH on Robinhood Chain mainnet

## Steps

```bash
cd contracts

# Smoke-test locally
forge test --match-contract SignaRoomRegistryTest

# Deploy + verify on Robinhood Chain
PRIVATE_KEY=0x<deployer_key> forge script script/DeployRoomRegistry.s.sol \
  --rpc-url robinhood_mainnet \
  --broadcast \
  --verify --verifier blockscout --verifier-url https://robinhoodchain.blockscout.com/api/
```

The deploy script prints the contract address. Copy it.

## Post-deploy

1. Set `SIGNA_ROOM_REGISTRY_ADDRESS` in Vercel env (production):
   ```bash
   printf '0x<deployed_address>' | npx vercel env add SIGNA_ROOM_REGISTRY_ADDRESS production
   ```
2. Trigger a redeploy. The web app's `/api/rooms/[slug]/anchor` route will start returning live anchor data.
3. Rooms that get their manifest hash anchored will surface an `ANCHORED ON ROBINHOOD CHAIN` badge in the chat header.

## Anchoring a room manually

Any wallet can call `anchor(slug, manifestHash)`:

- `slug` — the room's lowercase slug
- `manifestHash` — `keccak256(signed_message)` where `signed_message` is the canonical preimage the creator wallet signed when creating the room

The `web/lib/onchain-rooms.ts` module's `computeManifestHash(signedMessage)` helper produces the same hash a contract caller needs.

## What's anchored vs not

- Anchoring is opt-in per room
- Reads and posting work fine without anchoring — anchor is a federation trust signal, not a hard requirement
- Costs ~50k gas (a fraction of a cent on Robinhood Chain) per anchor call
