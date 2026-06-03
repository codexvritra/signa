/**
 * Unified capability resolver — the one place that turns a capability name +
 * arg into a real output plus its provenance (which provider produced it).
 * Resolution order mirrors /api/capabilities/invoke:
 *   1. built-in (SIGNA gateway fulfils from a real source)
 *   2. registered off-chain (one-signature marketplace)
 *   3. on-chain (SignaCapabilityRegistry on Base)
 *
 * Used by Signed Pipelines so every step records WHO produced it. Priced
 * capabilities are not run here (pipelines v1 are free-step only) — they throw
 * a clear error so a step fails loudly rather than silently skipping payment.
 */
import { CAPABILITY_CATALOG, fulfillCapability } from "@/lib/capabilities";
import { getRegistered, callRegistered } from "@/lib/marketplace";
import { getOnchainCapability } from "@/lib/onchain-capabilities";

export type Fulfilled = {
  output: unknown;
  provider: string; // partner id (built-in) or provider wallet (registered/on-chain)
  source: string; // host / source label
  kind: "builtin" | "registered" | "onchain";
};

function hostOf(endpoint: string): string {
  try { return new URL(endpoint).host; } catch { return "unknown"; }
}

/** Resolve + fulfil a capability by name. Throws on unknown / priced / failure. */
export async function fulfillAny(cap: string, arg: string): Promise<Fulfilled> {
  const builtin = CAPABILITY_CATALOG.find((c) => c.name === cap);
  if (builtin) {
    const output = await fulfillCapability(cap, arg);
    return { output, provider: builtin.provider, source: builtin.source, kind: "builtin" };
  }

  const rec = (await getRegistered(cap)) ?? (await getOnchainCapability(cap));
  if (rec) {
    if (rec.price_usdc > 0) {
      throw new Error(`capability "${cap}" is priced (${rec.price_usdc} USDC/call); priced steps are not supported in a pipeline yet — call it directly via /api/capabilities/invoke with x402`);
    }
    const output = await callRegistered(rec, arg);
    const kind = (rec as { source?: string }).source === "onchain" ? "onchain" : "registered";
    return { output, provider: rec.provider_address, source: hostOf(rec.endpoint), kind };
  }

  throw new Error(`unknown capability: ${cap}`);
}
