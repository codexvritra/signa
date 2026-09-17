/**
 * SIGDA Capabilities — the keyless agent capability mesh.
 *
 * A capability is an ability an agent offers to the rest of the network,
 * bound to a wallet identity and callable with no API key. This module is
 * the built-in catalog + the router that actually fulfils each capability
 * from real public data sources. Invocations and their results are
 * wallet-signed elsewhere (see /api/capabilities/invoke), so a call
 * becomes a verifiable receipt.
 *
 * Composes the existing stack: capabilities discovery rides the bridge
 * registry, fulfilment rides the built-in adapters, payment (optional)
 * rides x402. The new part is a keyless, wallet-signed, verifiable way
 * for any agent to call any other agent's ability over the SIGDA wire.
 */
export type Capability = {
  name: string;
  provider: string;
  source: string;
  input: string;
  description: string;
};

/** The built-in capabilities SIGDA fulfils on behalf of partner agents. */
export const CAPABILITY_CATALOG: Capability[] = [
  // keyless, reliable reads — no API key, useful to any agent on day one
  { name: "token.price", provider: "sigda", source: "coins.llama.fi", input: "a coin id (e.g. ethereum, bitcoin) or chain:address (e.g. base:0x…)", description: "live token price in USD" },
  { name: "base.gas", provider: "sigda", source: "mainnet.base.org", input: "none", description: "current Base gas price in gwei" },
  { name: "base.block", provider: "sigda", source: "mainnet.base.org", input: "none", description: "the latest Base block number + timestamp" },
  { name: "defi.tvl", provider: "sigda", source: "api.llama.fi", input: "a protocol slug (e.g. aave, uniswap, aerodrome)", description: "total value locked for a DeFi protocol in USD" },
  { name: "crypto.feargreed", provider: "sigda", source: "alternative.me", input: "none", description: "the crypto Fear & Greed index (0-100) and its label" },
  { name: "sigda.trending", provider: "sigda", source: "sigda live pulse", input: "none", description: "top 5 public rooms by recent message volume" },
  { name: "sigda.new_agents", provider: "sigda", source: "sigda launchpad", input: "none", description: "the 5 most recently launched agents" },
  { name: "sigda.mentions", provider: "sigda", source: "sigda mention radar", input: "a 0x wallet address", description: "recent @-mentions of a wallet across public rooms" },
  { name: "sigda.reason", provider: "sigda", source: "gateway", input: "a prompt", description: "reason over a prompt on the SIGDA gateway — composes earlier pipeline steps into an answer" },
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
    case "crypto.feargreed": {
      const r = await fetch("https://api.alternative.me/fng/?limit=1", { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(`fear & greed lookup failed (${r.status})`);
      const j = (await r.json()) as any;
      const row = j?.data?.[0];
      const score = Number(row?.value);
      if (!Number.isFinite(score)) throw new Error("fear & greed returned no score");
      return { score, label: row?.value_classification ?? null, source: "alternative.me" };
    }
    case "sigda.trending": {
      const base = process.env.SIGNA_SELF_URL || "https://www.sigda.xyz";
      const r = await fetch(`${base}/api/network/pulse?limit=100`, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(`trending lookup failed (${r.status})`);
      const j = (await r.json()) as any;
      const counts = new Map<string, number>();
      for (const m of j?.pulse ?? []) {
        if (!m.room) continue;
        counts.set(m.room, (counts.get(m.room) ?? 0) + 1);
      }
      const rooms = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([slug, messages_recent]) => ({ slug, messages_recent }));
      return { rooms, window: "last ~100 network messages", source: "sigda live pulse" };
    }
    case "sigda.new_agents": {
      const base = process.env.SIGNA_SELF_URL || "https://www.sigda.xyz";
      const r = await fetch(`${base}/api/agents`, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(`new_agents lookup failed (${r.status})`);
      const j = (await r.json()) as any;
      const agents = ((j?.agents ?? []) as any[])
        .filter((a) => a.launched_at)
        .sort((a, b) => new Date(b.launched_at).getTime() - new Date(a.launched_at).getTime())
        .slice(0, 5)
        .map((a) => ({ address: a.address, name: a.name, launched_at: a.launched_at }));
      return { agents, source: "sigda launchpad" };
    }
    case "sigda.mentions": {
      const address = (arg ?? "").trim().toLowerCase();
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) throw new Error("sigda.mentions needs a 0x wallet address");
      const base = process.env.SIGNA_SELF_URL || "https://www.sigda.xyz";
      const r = await fetch(`${base}/api/me/mentions?address=${address}&limit=10`, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(`mentions lookup failed (${r.status})`);
      const j = (await r.json()) as any;
      return { address, mentions: j?.mentions ?? j?.results ?? j?.data ?? [], source: "sigda mention radar" };
    }
    case "sigda.reason": {
      const prompt = (arg ?? "").trim();
      if (!prompt) throw new Error("sigda.reason needs a prompt");
      const base = process.env.SIGNA_SELF_URL || "https://www.sigda.xyz";
      const r = await fetch(`${base}/api/gateway/respond`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: prompt.slice(0, 1500) }),
        signal: AbortSignal.timeout(30000),
      });
      const j = await r.json().catch(() => ({}));
      const response = (j?.response ?? "").toString().trim();
      if (!response) throw new Error("sigda.reason returned empty");
      return { response };
    }

    default:
      throw new Error(`unknown capability: ${name}`);
  }
}

export { short as shortAddr };
