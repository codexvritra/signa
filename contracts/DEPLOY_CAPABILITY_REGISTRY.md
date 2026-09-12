# Deploying SignaCapabilityRegistry to Robinhood Chain

`SignaCapabilityRegistry` is the trustless tier of the SIGNA capability marketplace (v1.9). A provider registers a capability with one Robinhood Chain transaction and the full callable spec — endpoint, method, price, payout — lives on chain. Any agent reads it straight from Robinhood Chain and calls it, with no trust in SIGNA's index.

## Prerequisites

- Foundry installed (`forge --version`)
- A deployer wallet with a little ETH for gas (~0.0003 ETH on Robinhood Chain mainnet; **free** on Robinhood Chain testnet)

## Smoke-test locally (free, no chain)

```bash
cd contracts
forge test --match-contract SignaCapabilityRegistryTest -vv   # 17 tests
```

Or run the full end-to-end proof against a local chain (deploy → register → read from chain → resolve real data):

```bash
cd web && node scripts/v109-onchain-registry.mjs
```

## Deploy to Robinhood Chain testnet (free)

```bash
cd contracts
PRIVATE_KEY=0x<deployer_key> forge script script/DeployCapabilityRegistry.s.sol \
  --rpc-url robinhood_testnet --broadcast
```

## Deploy to Robinhood Chain mainnet

```bash
cd contracts
PRIVATE_KEY=0x<deployer_key> forge script script/DeployCapabilityRegistry.s.sol \
  --rpc-url robinhood_mainnet --broadcast \
  --verify --verifier blockscout --verifier-url https://robinhoodchain.blockscout.com/api/
```

The deploy script prints the contract address. Copy it.

## Post-deploy

1. Set the address in Vercel env (production):
   ```bash
   printf '0x<deployed_address>' | npx vercel env add SIGNA_CAPABILITY_REGISTRY_ADDRESS production
   ```
   (Optional) set `SIGNA_CAPABILITY_REGISTRY_RPC` if you want the reader to use a dedicated RPC instead of the shared `ROBINHOOD_RPC_URL`.
2. Trigger a redeploy. `/api/capabilities` then merges the on-chain registry into the directory under `onchain`, and `/api/capabilities/invoke` resolves on-chain-only capabilities by reading the spec from chain.
3. The `/marketplace` page surfaces an **on-chain · trustless tier** section automatically.

## Registering a capability on chain

Any wallet can call:

```
register(string name, string endpoint, string method, string description, uint256 priceUsdc, address payTo)
```

- `name` — namespaced, e.g. `myteam.summarize` (1..40 bytes)
- `endpoint` — must begin with `https://` (enforced on-chain), <=256 bytes
- `method` — `GET` or `POST` (enforced on-chain)
- `priceUsdc` — per-call price in stablecoin base units, 6dp (USDG on Robinhood Chain), 0 for free, <= 100 USDG
- `payTo` — payout address, or `address(0)` to default to the caller

First-write-wins on the name; only the original provider can `register` again (update) or `deregister`. Costs ~280k gas (a fraction of a cent on Robinhood Chain) for a first registration.

## What's on-chain vs not

- The full callable spec is on-chain — that is the point (trustless discovery).
- The SSRF guard still runs at **call time** in the gateway, so a hostile endpoint registered on-chain is still blocked when invoked.
- The off-chain one-signature path (`POST /api/capabilities/register`) remains for zero-gas instant registration; both tiers appear in the same directory.
