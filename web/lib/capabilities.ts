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
];

const short = (a?: string) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a ?? "");

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
    default:
      throw new Error(`unknown capability: ${name}`);
  }
}

export { short as shortAddr };
