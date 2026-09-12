/**
 * SIGNA Capabilities — the keyless agent capability mesh.
 *
 * A capability is an ability an agent offers to the rest of the network,
 * bound to a wallet identity and callable with no API key. This module is
 * the built-in catalog + the router that actually fulfils each capability
 * from the real partner sources (Bankr, Root Edge). Invocations and their
 * results are wallet-signed elsewhere (see /api/capabilities/invoke), so a
 * call becomes a verifiable receipt.
 *
 * Composes the existing stack: capabilities discovery rides the bridge
 * registry, fulfilment rides the partner adapters, payment (optional) rides
 * x402. The new part is a keyless, wallet-signed, verifiable way for any
 * agent to call any other agent's ability over the SIGNA wire.
 */
import { bankrResolveRecipient, bankrRecentLaunches } from "@/lib/skills/bankr";
import { rootIntel, rootMarketSummary } from "@/lib/root";

export type Capability = {
  name: string;
  provider: string;
  source: string;
  input: string;
  description: string;
};

/** The built-in capabilities SIGNA fulfils on behalf of partner agents. */
export const CAPABILITY_CATALOG: Capability[] = [
  { name: "bankr.resolve", provider: "bankr", source: "api.bankr.bot", input: "a social handle (@x), ENS, or 0x", description: "resolve any identity to a wallet that is reachable on the bus" },
  { name: "bankr.launches", provider: "bankr", source: "api.bankr.bot", input: "none", description: "the latest token launches on Base" },
  { name: "root.market", provider: "root-edge", source: "mcp.rootedge.ai", input: "none", description: "current Base market read — sentiment + top opportunity" },
  { name: "root.feargreed", provider: "root-edge", source: "mcp.rootedge.ai", input: "none", description: "the crypto fear and greed index" },
  // keyless, reliable reads — no API key, useful to any agent on day one
  { name: "token.price", provider: "signa", source: "coins.llama.fi", input: "a coin id (e.g. ethereum, bitcoin) or chain:address (e.g. base:0x…)", description: "live token price in USD" },
  { name: "base.gas", provider: "signa", source: "mainnet.base.org", input: "none", description: "current Base gas price in gwei" },
  { name: "base.block", provider: "signa", source: "mainnet.base.org", input: "none", description: "the latest Base block number + timestamp" },
  { name: "defi.tvl", provider: "signa", source: "api.llama.fi", input: "a protocol slug (e.g. aave, uniswap, aerodrome)", description: "total value locked for a DeFi protocol in USD" },
  { name: "signa.reason", provider: "signa", source: "gateway", input: "a prompt", description: "reason over a prompt on the SIGNA gateway — composes earlier pipeline steps into an answer" },
];

const short = (a?: string) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a ?? "");

/** Minimal keyless JSON-RPC call to the Base mainnet RPC. */
async function baseRpc(method: string, params: unknown[]): Promise<any> {
  const url = process.env.BASE_RPC_URL || "https://mainnet.base.org";
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`base rpc ${method} failed (${r.status})`);
  const j = await r.json();
  if (j?.error) throw new Error(`base rpc ${method}: ${j.error?.message ?? "error"}`);
  return j?.result;
}

/** Fulfil a capability from its real source. Throws on unknown capability. */
export async function fulfillCapability(name: string, arg?: string): Promise<unknown> {
  switch (name) {
    case "bankr.resolve": {
      const handle = (arg ?? "").replace(/^@/, "").trim();
      if (!handle) throw new Error("bankr.resolve needs an input handle");
      for (const t of ["twitter", "farcaster"] as const) {
        const res = await bankrResolveRecipient(handle, t);
        const addr = res?.address;
        if (addr && /^0x[a-fA-F0-9]{40}$/.test(addr)) {
          return { address: addr.toLowerCase(), displayName: (res as any)?.displayName ?? `@${handle}`, via: t, reachable_on_bus: true };
        }
      }
      throw new Error(`bankr could not resolve "${handle}"`);
    }
    case "bankr.launches": {
      const launches = (await bankrRecentLaunches(3)) as any[];
      return {
        launches: launches.slice(0, 3).map((l) => ({
          name: l.tokenName ?? l.name ?? null,
          symbol: l.tokenSymbol ?? l.symbol ?? null,
          address: l.tokenAddress ?? l.address ?? null,
          chain: l.chain ?? "base",
        })),
      };
    }
    case "root.market": {
      return { summary: await rootMarketSummary() };
    }
    case "root.feargreed": {
      const fg = (await rootIntel("feargreed")) as any;
      return { score: fg?.score ?? null, label: fg?.label ?? null };
    }

    // ─────── keyless built-in reads (no API key) ───────
    case "token.price": {
      const raw = (arg ?? "").trim();
      // accept "ethereum" (coingecko id) or "chain:address" (e.g. base:0x…)
      const coinId = raw ? (raw.includes(":") ? raw : `coingecko:${raw.toLowerCase()}`) : "coingecko:ethereum";
      const r = await fetch(`https://coins.llama.fi/prices/current/${encodeURIComponent(coinId)}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(`price lookup failed (${r.status})`);
      const j = (await r.json()) as any;
      const c = j?.coins?.[coinId];
      if (!c || typeof c.price !== "number") throw new Error(`no price for "${raw || "ethereum"}"`);
      return { id: coinId, symbol: c.symbol ?? null, price_usd: c.price, confidence: c.confidence ?? null, source: "DefiLlama" };
    }
    case "base.gas": {
      const wei = await baseRpc("eth_gasPrice", []);
      const gwei = Number(BigInt(wei)) / 1e9;
      return { gas_price_wei: BigInt(wei).toString(), gas_price_gwei: Math.round(gwei * 1000) / 1000, chain: "base" };
    }
    case "base.block": {
      const hex = await baseRpc("eth_blockNumber", []);
      const number = Number(BigInt(hex));
      const block = (await baseRpc("eth_getBlockByNumber", [hex, false])) as any;
      const ts = block?.timestamp ? Number(BigInt(block.timestamp)) : null;
      return { number, timestamp: ts, iso: ts ? new Date(ts * 1000).toISOString() : null, chain: "base" };
    }
    case "defi.tvl": {
      const slug = (arg ?? "").trim().toLowerCase().replace(/\s+/g, "-");
      if (!slug) throw new Error("defi.tvl needs a protocol slug (e.g. aave, aerodrome)");
      const r = await fetch(`https://api.llama.fi/tvl/${encodeURIComponent(slug)}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(`tvl lookup failed for "${slug}" (${r.status})`);
      const tvl = await r.json();
      if (typeof tvl !== "number") throw new Error(`no TVL for protocol "${slug}"`);
      return { protocol: slug, tvl_usd: tvl, source: "DefiLlama" };
    }
    case "signa.reason": {
      const prompt = (arg ?? "").trim();
      if (!prompt) throw new Error("signa.reason needs a prompt");
      const base = process.env.SIGNA_SELF_URL || "https://www.signaagent.xyz";
      const r = await fetch(`${base}/api/gateway/respond`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: prompt.slice(0, 1500) }),
        signal: AbortSignal.timeout(30000),
      });
      const j = await r.json().catch(() => ({}));
      const response = (j?.response ?? "").toString().trim();
      if (!response) throw new Error("signa.reason returned empty");
      return { response };
    }

    default:
      throw new Error(`unknown capability: ${name}`);
  }
}

export { short as shortAddr };
