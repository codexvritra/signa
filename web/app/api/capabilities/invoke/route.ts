import { NextRequest, NextResponse } from "next/server";
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, toBytes } from "viem";
import { createHash } from "node:crypto";
import { CAPABILITY_CATALOG, fulfillCapability } from "@/lib/capabilities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/capabilities/invoke?cap=<name>&arg=<input>
 * POST { cap, arg }
 *
 * Invoke a capability and get back a WALLET-SIGNED, verifiable result. The
 * SIGNA capability gateway fulfils the call from the real source and signs an
 * attestation: "capability <cap> with input <arg> produced this output at
 * <ts>." Anyone can re-verify the signature against the gateway address with
 * viem — the result is tamper-evident, no trust in SIGNA required.
 *
 * Keyless: the caller needs no API key. Optional payment rides x402 when a
 * provider prices a capability (none of the built-ins do today).
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
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

async function run(cap: string, arg: string) {
  const meta = CAPABILITY_CATALOG.find((c) => c.name === cap);
  if (!meta) {
    return NextResponse.json(
      { ok: false, error: "unknown_capability", available: CAPABILITY_CATALOG.map((c) => c.name) },
      { status: 404, headers: CORS },
    );
  }
  let output: unknown;
  try {
    output = await fulfillCapability(cap, arg);
  } catch (e) {
    return NextResponse.json(
      { ok: false, capability: cap, error: e instanceof Error ? e.message : "fulfilment failed" },
      { status: 502, headers: CORS },
    );
  }
  const ts = Date.now();
  const preimage = resultPreimage(cap, arg, meta.provider, ts, output);
  const signature = await gateway.signMessage({ message: preimage });
  return NextResponse.json(
    {
      ok: true,
      capability: cap,
      input: arg,
      provider: meta.provider,
      source: meta.source,
      output,
      ts,
      gateway: gateway.address.toLowerCase(),
      signature,
      verify: {
        scheme: "eip191",
        preimage,
        how: "recompute sha256(JSON.stringify(output)), rebuild the preimage, verifyMessage against `gateway`",
      },
    },
    { headers: CORS },
  );
}

export async function GET(req: NextRequest) {
  const cap = req.nextUrl.searchParams.get("cap") ?? "";
  const arg = req.nextUrl.searchParams.get("arg") ?? "";
  if (!cap) return NextResponse.json({ ok: false, error: "missing_cap", available: CAPABILITY_CATALOG.map((c) => c.name) }, { status: 400, headers: CORS });
  return run(cap, arg);
}

export async function POST(req: NextRequest) {
  let cap = "", arg = "";
  try { const b = await req.json(); cap = b?.cap ?? ""; arg = b?.arg ?? b?.input ?? ""; } catch { /* ignore */ }
  if (!cap) return NextResponse.json({ ok: false, error: "missing_cap", available: CAPABILITY_CATALOG.map((c) => c.name) }, { status: 400, headers: CORS });
  return run(cap, arg);
}
