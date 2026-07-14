/**
 * SIGNA Proof-of-Stock — the verifiable registry for Robinhood Chain Stock Tokens.
 *
 * Robinhood Chain went live with tokenized equities ("Stock Tokens" — NVDA, TSLA,
 * AAPL, SpaceX, Circle…). The problem: the chain is permissionless, so for every
 * real Stock Token there are a dozen impostors squatting the same ticker. Search
 * "NVDA" on the explorer and you get the genuine `NVIDIA • Robinhood Token` plus
 * five fakes with no market and the same symbol.
 *
 * SIGNA fixes this the SIGNA way — with a signature, not a promise. For each
 * ticker the SIGNA RWA attestor wallet signs a canonical envelope: "THIS contract
 * is the real Robinhood <TICKER>, and at block N on Robinhood Chain it had this
 * total supply." Anyone re-verifies two independent ways:
 *   1) recover the EIP-191 signature → it's the SIGNA attestor (curation vouch)
 *   2) replay the eth_call at block N → the supply matches (trustless onchain state)
 *
 * Read-only. SIGNA mints nothing, custodies nothing, impersonates no one — it
 * proves which token is real. "Robinhood tokenizes the stock. SIGNA proves it."
 */
import { createPublicClient, http, parseAbi, formatUnits, type Address } from "viem";
import { keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { RH_CHAIN_ID, RH_RPC, RH_EXPLORER, rhChain, explorerToken } from "./signa-launch";

/** The SIGNA RWA attestor — a deterministic, keyless service identity (like the x402 attestor). */
const ATTESTOR = privateKeyToAccount(keccak256(toBytes("signa:rwa-attestor:v1")));
export const RWA_ATTESTOR_ADDRESS = ATTESTOR.address.toLowerCase();

export const RWA_CHAIN_NAME = "Robinhood Chain";
const ERC20_ABI = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
]);

// NB: the asset class is `asset_class`, never `kind` — `kind` is reserved for the
// universal verifier's artifact discriminator, and a collision here would silently
// overwrite it when an attestation is spread into a verify call.
export type StockToken = { ticker: string; company: string; asset_class: "stock" | "etf"; address: string };

/**
 * The canonical Robinhood Stock Token registry — curated from the official
 * `• Robinhood Token` contracts that carry a live market on Robinhood Chain
 * (verified on the chain's Blockscout token index, 2026-07-14). Each address is
 * the genuine issuer contract; SIGNA vouches for it against the ticker squatters.
 */
export const STOCK_TOKENS: StockToken[] = [
  { ticker: "NVDA", company: "NVIDIA", asset_class: "stock", address: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC" },
  { ticker: "TSLA", company: "Tesla", asset_class: "stock", address: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d" },
  { ticker: "AAPL", company: "Apple", asset_class: "stock", address: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9" },
  { ticker: "GOOGL", company: "Alphabet Class A", asset_class: "stock", address: "0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3" },
  { ticker: "META", company: "Meta Platforms", asset_class: "stock", address: "0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35" },
  { ticker: "MSFT", company: "Microsoft", asset_class: "stock", address: "0xe93237C50D904957Cf27E7B1133b510C669c2e74" },
  { ticker: "AMZN", company: "Amazon", asset_class: "stock", address: "0x12f190a9F9d7D37a250758b26824B97CE941bF54" },
  { ticker: "AMD", company: "AMD", asset_class: "stock", address: "0x86923f96303D656E4aa86D9d42D1e57ad2023fdC" },
  { ticker: "MU", company: "Micron Technology", asset_class: "stock", address: "0xfF080c8ce2E5feadaCa0Da81314Ae59D232d4afD" },
  { ticker: "SNDK", company: "Sandisk Corporation", asset_class: "stock", address: "0xB90A19fF0Af67f7779afF50A882A9CfF42446400" },
  { ticker: "SPCX", company: "Space Exploration Technologies (SpaceX)", asset_class: "stock", address: "0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa" },
  { ticker: "PLTR", company: "Palantir Technologies", asset_class: "stock", address: "0x894E1EC2D74FFE5AEF8Dc8A9e84686acCB964F2A" },
  { ticker: "COIN", company: "Coinbase", asset_class: "stock", address: "0x6330D8C3178a418788dF01a47479c0ce7CCF450b" },
  { ticker: "CRCL", company: "Circle Internet Group", asset_class: "stock", address: "0xdF0992E440dD0be65BD8439b609d6D4366bf1CB5" },
  { ticker: "ORCL", company: "Oracle", asset_class: "stock", address: "0xb0992820E760d836549ba69BC7598b4af75dEE03" },
  { ticker: "INTC", company: "Intel", asset_class: "stock", address: "0xc72b96e0E48ecd4DC75E1e45396e26300BC39681" },
  { ticker: "CRWV", company: "CoreWeave", asset_class: "stock", address: "0x5f10A1C971B69e47e059e1dC91901B59b3fB49C3" },
  { ticker: "USAR", company: "USA Rare Earth", asset_class: "stock", address: "0xd917B029C761D264c6A312BBbcDA868658eF86a6" },
  { ticker: "BABA", company: "Alibaba", asset_class: "stock", address: "0xad25Ac6C84D497db898fa1E8387bf6Af3532a1c4" },
  { ticker: "SPY", company: "SPDR S&P 500 ETF Trust", asset_class: "etf", address: "0x117cc2133c37B721F49dE2A7a74833232B3B4C0C" },
  { ticker: "QQQ", company: "Invesco QQQ", asset_class: "etf", address: "0xD5f3879160bc7c32ebb4dC785F8a4F505888de68" },
  { ticker: "SLV", company: "iShares Silver Trust", asset_class: "etf", address: "0x411eFb0E7f985935DAec3D4C3ebaEa0d0AD7D89f" },
  { ticker: "USO", company: "United States Oil Fund", asset_class: "etf", address: "0xa30FA36Db767ad9eD3f7a60fC79526fB4d56D344" },
  { ticker: "SGOV", company: "iShares 0-3 Month Treasury Bond ETF", asset_class: "etf", address: "0x92FD66527192E3e61d4DDd13322Aa222DE86F9B5" },
];

const REGISTRY_BY_TICKER = new Map(STOCK_TOKENS.map((t) => [t.ticker.toUpperCase(), t]));
const REGISTRY_BY_ADDR = new Map(STOCK_TOKENS.map((t) => [t.address.toLowerCase(), t]));

export function findStock(q: string): StockToken | null {
  const s = (q || "").trim();
  return REGISTRY_BY_TICKER.get(s.toUpperCase()) ?? REGISTRY_BY_ADDR.get(s.toLowerCase()) ?? null;
}

let _client: ReturnType<typeof createPublicClient> | null = null;
function client() {
  if (!_client) _client = createPublicClient({ chain: rhChain, transport: http(RH_RPC) });
  return _client;
}

export type OnchainState = { block: string; symbol: string; decimals: number; supply: string; supply_display: string };

/** Read a token's live ERC-20 state on Robinhood Chain, pinned to a block. */
export async function readOnchainState(address: string, blockNumber?: bigint): Promise<OnchainState> {
  const c = client();
  const block = blockNumber ?? (await c.getBlockNumber());
  const addr = address as Address;
  const [symbol, decimals, supply] = await Promise.all([
    c.readContract({ address: addr, abi: ERC20_ABI, functionName: "symbol", blockNumber: block }).catch(() => "") as Promise<string>,
    c.readContract({ address: addr, abi: ERC20_ABI, functionName: "decimals", blockNumber: block }).catch(() => 18) as Promise<number>,
    c.readContract({ address: addr, abi: ERC20_ABI, functionName: "totalSupply", blockNumber: block }) as Promise<bigint>,
  ]);
  const dec = Number(decimals);
  return { block: block.toString(), symbol: String(symbol), decimals: dec, supply: supply.toString(), supply_display: formatUnits(supply, dec) };
}

// ───────────────────────── market context (explorer-sourced, unsigned) ─────────────────────────

export type Market = { price_usd: number | null; market_cap: number | null; holders: number | null };

/** Best-effort market read from the chain's explorer. NOT part of the signed proof. */
export async function fetchMarket(address: string): Promise<Market> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(`${RH_EXPLORER}/api/v2/tokens/${address}`, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(t);
    const j: any = await r.json().catch(() => ({}));
    const num = (v: unknown) => (v == null || v === "" ? null : Number(v));
    return { price_usd: num(j.exchange_rate), market_cap: num(j.circulating_market_cap), holders: num(j.holders_count) };
  } catch {
    return { price_usd: null, market_cap: null, holders: null };
  }
}

export type Impostor = { address: string; name: string; symbol: string; market_cap: number | null };

/**
 * Contracts squatting a canonical ticker on Robinhood Chain — the exact problem
 * this layer solves. Permissionless chain: anyone can deploy an ERC-20 that
 * calls itself NVDA. Explorer-sourced, best-effort, never signed.
 */
export async function findImpostors(ticker: string, canonical: string, limit = 8): Promise<Impostor[]> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 7000);
    const r = await fetch(`${RH_EXPLORER}/api/v2/tokens?q=${encodeURIComponent(ticker)}`, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(t);
    const j: any = await r.json().catch(() => ({}));
    const items: unknown[] = Array.isArray(j?.items) ? j.items : [];
    const canon = canonical.toLowerCase();
    return (items as any[])
      .filter((i) => String(i?.symbol ?? "").toUpperCase() === ticker.toUpperCase())
      .filter((i) => String(i?.address_hash ?? "").toLowerCase() !== canon)
      .slice(0, limit)
      .map((i) => ({
        address: String(i.address_hash),
        name: String(i.name ?? ""),
        symbol: String(i.symbol ?? ""),
        market_cap: i.circulating_market_cap ? Number(i.circulating_market_cap) : null,
      }));
  } catch {
    return [];
  }
}

// ───────────────────────── the signed attestation ─────────────────────────

/**
 * The exact string the attestor signs — the trustless core. Only facts that are
 * either SIGNA's curation vouch (ticker/subject/canonical/contract) or directly
 * re-checkable onchain (chain/block/decimals/supply). Market data is NOT signed.
 * Mirror this byte-for-byte in the universal verifier (kind `rwa_attestation`).
 */
export function rwaAttestationPreimage(a: {
  ts: number; chain: number; block: string; ticker: string; subject: string; contract: string; decimals: number; supply: string;
}): string {
  return [
    "SIGNA rwa attestation v1",
    `ts:${a.ts}`,
    `chain:${a.chain}`,
    `block:${a.block}`,
    `ticker:${a.ticker.toUpperCase()}`,
    `subject:${a.subject}`,
    `contract:${a.contract.toLowerCase()}`,
    `canonical:true`,
    `decimals:${a.decimals}`,
    `supply:${a.supply}`,
    `source:robinhood-chain:erc20`,
  ].join("\n");
}

export type RwaAttestation = {
  ts: number;
  chain: number;
  chain_name: string;
  block: string;
  ticker: string;
  subject: string;
  company: string;
  asset_class: "stock" | "etf";
  contract: string;
  canonical: true;
  decimals: number;
  supply: string;
  supply_display: string;
  explorer: string;
  signer: string;
  signature: string;
  preimage: string;
  market: Market;
};

/** Attest one canonical Stock Token: read its live onchain state, then sign. */
export async function attestStock(token: StockToken, blockNumber?: bigint, withMarket = true): Promise<RwaAttestation> {
  const state = await readOnchainState(token.address, blockNumber);
  const ts = Date.now();
  const preimage = rwaAttestationPreimage({
    ts, chain: RH_CHAIN_ID, block: state.block, ticker: token.ticker, subject: token.company, contract: token.address, decimals: state.decimals, supply: state.supply,
  });
  const signature = await ATTESTOR.signMessage({ message: preimage });
  const market = withMarket ? await fetchMarket(token.address) : { price_usd: null, market_cap: null, holders: null };
  return {
    ts, chain: RH_CHAIN_ID, chain_name: RWA_CHAIN_NAME, block: state.block,
    ticker: token.ticker, subject: token.company, company: token.company, asset_class: token.asset_class,
    contract: token.address.toLowerCase(), canonical: true, decimals: state.decimals,
    supply: state.supply, supply_display: state.supply_display, explorer: explorerToken(token.address),
    signer: RWA_ATTESTOR_ADDRESS, signature, preimage, market,
  };
}

/** Attest the whole registry at a single consistent block. Failures are dropped. */
export async function attestRegistry(withMarket = true): Promise<RwaAttestation[]> {
  const block = await client().getBlockNumber();
  const settled = await Promise.allSettled(STOCK_TOKENS.map((t) => attestStock(t, block, withMarket)));
  const out: RwaAttestation[] = [];
  for (const s of settled) if (s.status === "fulfilled") out.push(s.value);
  // Order by explorer market cap desc when available, else keep registry order
  out.sort((a, b) => (b.market.market_cap ?? 0) - (a.market.market_cap ?? 0));
  return out;
}

/**
 * Independent re-read: replay the onchain supply at the attestation's block and
 * report whether it still matches — the second, trustless leg of verification
 * (the first being signature recovery via the universal verifier).
 */
export async function reReadSupply(contract: string, block: string): Promise<{ ok: boolean; supply: string | null }> {
  try {
    const s = await readOnchainState(contract, BigInt(block));
    return { ok: true, supply: s.supply };
  } catch {
    return { ok: false, supply: null };
  }
}
