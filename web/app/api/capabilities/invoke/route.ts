import { NextRequest, NextResponse } from "next/server";
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, toBytes } from "viem";
import { createHash } from "node:crypto";
import { CAPABILITY_CATALOG, fulfillCapability } from "@/lib/capabilities";
import { getRegistered, callRegistered, bumpCalls } from "@/lib/marketplace";
import { getOnchainCapability } from "@/lib/onchain-capabilities";
import {
  build402Challenge,
  decodePaymentHeader,
  verifyExactPayment,
  DEFAULT_ASSET_BASE_USDC,
  EIP3009_TOKENS,
  type InboxPrice,
} from "@/lib/x402-paid-dm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/capabilities/invoke?cap=<name>&arg=<input>
 * POST { cap, arg }
 *
 * Invoke a capability and get back a WALLET-SIGNED, verifiable result. Two
 * kinds of capability resolve through the same endpoint:
 *
 *  - built-ins SIGNA fulfils from real partner sources (Bankr, Root Edge)
 *  - capabilities any developer registered with one wallet-signed call
 *    (the open marketplace) — proxied through an SSRF-guarded fetch
 *
 * Either way the SIGNA capability gateway signs an attestation over
 * (cap, input, provider, ts, sha256(output)). Anyone re-verifies it against
 * the gateway address with viem — the result is tamper-evident; no trust in
 * SIGNA required. Keyless: the caller needs no API key.
 *
 * Optional pricing rides x402: a provider may price a registered capability,
 * in which case this endpoint behaves as a non-custodial x402 resource server
 * — it returns a 402 challenge, verifies the presented EIP-3009 authorization
 * pays the provider, then fulfils. SIGNA never settles and never holds funds.
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-payment",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// deterministic gateway identity (holds no funds — it only signs attestations)
const gateway = privateKeyToAccount(keccak256(toBytes("signa:capability-gateway:v1")));

function resultPreimage(cap: string, input: string, provider: string, ts: number, output: unknown): string {
  const outHash = createHash("sha256").update(JSON.stringify(output)).digest("hex");
  return ["SIGNA capability result v1", `cap:${cap}`, `input:${input}`, `provider:${provider}`, `ts:${ts}`, `output:${outHash}`].join("\n");
}

async function signedResult(cap: string, input: string, provider: string, source: string, output: unknown, extra: Record<string, unknown> = {}) {
  const ts = Date.now();
  const preimage = resultPreimage(cap, input, provider, ts, output);
  const signature = await gateway.signMessage({ message: preimage });
  return NextResponse.json(
    {
      ok: true,
      capability: cap,
      input,
      provider,
      source,
      output,
      ts,
      gateway: gateway.address.toLowerCase(),
      signature,
      verify: {
        scheme: "eip191",
        preimage,
        how: "recompute sha256(JSON.stringify(output)), rebuild the preimage, verifyMessage against `gateway`",
      },
      ...extra,
    },
    { headers: CORS },
  );
}

/** A registered cap's USDC price expressed as an x402 InboxPrice (Base mainnet USDC). */
function capPrice(payTo: string, priceUsdc: number): InboxPrice {
  const asset = DEFAULT_ASSET_BASE_USDC;
  const token = EIP3009_TOKENS[asset];
  const raw = BigInt(Math.round(priceUsdc * 10 ** (token?.decimals ?? 6))).toString();
  return {
    address: payTo,
    price_raw: raw,
    pay_to: payTo,
    asset_address: asset,
    asset_symbol: token?.symbol ?? "USDC",
    asset_decimals: token?.decimals ?? 6,
    chain: "base",
  };
}

async function run(cap: string, arg: string, paymentHeader: string | null, resource: string) {
  // 1. built-in capability — fulfilled by the SIGNA gateway from a real source
  const meta = CAPABILITY_CATALOG.find((c) => c.name === cap);
  if (meta) {
    let output: unknown;
    try {
      output = await fulfillCapability(cap, arg);
    } catch (e) {
      return NextResponse.json({ ok: false, capability: cap, error: e instanceof Error ? e.message : "fulfilment failed" }, { status: 502, headers: CORS });
    }
    return signedResult(cap, arg, meta.provider, meta.source, output, { kind: "builtin" });
  }

  // 2. registered capability — off-chain (one signature) OR on-chain (trustless,
  //    read straight from Base). Off-chain is checked first; on-chain is the
  //    fallback so a capability registered only on Base is still callable here.
  const rec = (await getRegistered(cap)) ?? (await getOnchainCapability(cap));
  if (rec) {
    // optional x402 pricing — non-custodial. SIGNA verifies, never settles.
    let payment: { payer: string; amount_raw: string; asset: string } | undefined;
    if (rec.price_usdc > 0) {
      const payTo = rec.pay_to ?? rec.provider_address;
      const price = capPrice(payTo, rec.price_usdc);
      if (!paymentHeader) {
        return NextResponse.json(build402Challenge(price, resource), { status: 402, headers: CORS });
      }
      const decoded = decodePaymentHeader(paymentHeader);
      if (!decoded) return NextResponse.json({ ...build402Challenge(price, resource), error: "bad_payment_header" }, { status: 402, headers: CORS });
      // anonymous paid call: the payer is whoever signed the authorization;
      // we require it pays the provider the asked amount within its window.
      const v = await verifyExactPayment({ payment: decoded, price, expectedFrom: decoded.payload.authorization.from });
      if (!v.ok) return NextResponse.json({ ...build402Challenge(price, resource), error: `payment_invalid:${v.reason}` }, { status: 402, headers: CORS });
      payment = { payer: v.authorization.from.toLowerCase(), amount_raw: v.authorization.value, asset: v.assetAddress.toLowerCase() };
    }

    let output: unknown;
    try {
      output = await callRegistered(rec, arg);
    } catch (e) {
      return NextResponse.json({ ok: false, capability: cap, error: e instanceof Error ? e.message : "provider endpoint failed" }, { status: 502, headers: CORS });
    }
    void bumpCalls(cap); // best-effort usage counter
    return signedResult(cap, arg, rec.provider_address, new URL(rec.endpoint).host, output, {
      kind: "registered",
      ...(payment ? { payment, settlement: "the provider settles the x402 authorization out of band; SIGNA does not custody funds" } : {}),
    });
  }

  // 3. unknown
  return NextResponse.json(
    { ok: false, error: "unknown_capability", available: CAPABILITY_CATALOG.map((c) => c.name), hint: "browse the full directory at /api/capabilities or register your own at /api/capabilities/register" },
    { status: 404, headers: CORS },
  );
}

export async function GET(req: NextRequest) {
  const cap = req.nextUrl.searchParams.get("cap") ?? "";
  const arg = req.nextUrl.searchParams.get("arg") ?? "";
  if (!cap) return NextResponse.json({ ok: false, error: "missing_cap", available: CAPABILITY_CATALOG.map((c) => c.name) }, { status: 400, headers: CORS });
  return run(cap, arg, req.headers.get("x-payment"), req.nextUrl.href);
}

export async function POST(req: NextRequest) {
  let cap = "", arg = "";
  try { const b = await req.json(); cap = b?.cap ?? ""; arg = b?.arg ?? b?.input ?? ""; } catch { /* ignore */ }
  if (!cap) return NextResponse.json({ ok: false, error: "missing_cap", available: CAPABILITY_CATALOG.map((c) => c.name) }, { status: 400, headers: CORS });
  return run(cap, arg, req.headers.get("x-payment"), req.nextUrl.href);
}
