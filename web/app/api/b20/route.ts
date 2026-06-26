import { NextRequest, NextResponse } from "next/server";
import {
  B20_FACTORY, B20_LAUNCH_SIGNER, B20_NETWORK,
  b20Info, buildCreateB20Tx, predictB20Address, issueB20LaunchReceipt,
  type B20LaunchSpec, type B20Variant,
} from "@/lib/b20";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/b20 — SIGNA's verifiable launch + receipt layer for Base's native B20 token standard.
 *
 * GET  ?address=0x…[&holder=0x…]  → B20/ERC-20 token metadata (+ on-chain isB20, balance).
 * GET  (no address)               → factory + signer metadata.
 * POST { variant, name, symbol, creator, decimals?, currency? }
 *        → the exact createB20 calldata the caller's OWN wallet broadcasts, the predicted
 *          deterministic token address, and a wallet-signed B20 launch receipt re-verifiable
 *          by anyone at /api/verify (kind "b20_launch"). SIGNA never mints — it proves the launch.
 */

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
function json(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, { ...init, headers: { ...(init?.headers ?? {}), ...CORS } });
}

const isAddr = (a: unknown) => typeof a === "string" && /^0x[a-fA-F0-9]{40}$/.test(a);

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (address) {
    if (!isAddr(address)) return json({ ok: false, error: "address must be 0x…40" }, { status: 400 });
    try {
      const info = await b20Info(address, req.nextUrl.searchParams.get("holder") ?? undefined);
      return json({ ok: true, ...info });
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : "lookup failed" }, { status: 502 });
    }
  }
  return json({
    ok: true,
    standard: "B20",
    network: B20_NETWORK,
    factory: B20_FACTORY,
    variants: ["ASSET", "STABLECOIN"],
    launch_signer: B20_LAUNCH_SIGNER,
    note: "POST {variant,name,symbol,creator,decimals?,currency?} to get launch calldata + a signed, re-verifiable launch receipt. SIGNA never custodies funds; your wallet broadcasts the mint.",
  });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ ok: false, error: "invalid json" }, { status: 400 }); }

  const variant = String(body.variant ?? "ASSET").toUpperCase();
  if (variant !== "ASSET" && variant !== "STABLECOIN") return json({ ok: false, error: "variant must be ASSET or STABLECOIN" }, { status: 400 });
  const name = String(body.name ?? "").trim();
  const symbol = String(body.symbol ?? "").trim();
  const creator = String(body.creator ?? "").trim();
  if (!name || name.length > 64) return json({ ok: false, error: "name required (≤64 chars)" }, { status: 400 });
  if (!symbol || symbol.length > 16) return json({ ok: false, error: "symbol required (≤16 chars)" }, { status: 400 });
  if (!isAddr(creator)) return json({ ok: false, error: "creator must be a wallet address (0x…40)" }, { status: 400 });

  const spec: B20LaunchSpec = {
    variant: variant as B20Variant,
    name, symbol, creator,
    decimals: body.decimals != null ? Number(body.decimals) : undefined,
    currency: body.currency != null ? String(body.currency) : undefined,
    ts: Date.now(),
  };

  try {
    const tx = buildCreateB20Tx(spec);
    const predicted = await predictB20Address(spec); // best-effort (needs Beryl-aware RPC)
    const receipt = await issueB20LaunchReceipt(spec, predicted);
    return json({
      ok: true,
      network: B20_NETWORK,
      factory: B20_FACTORY,
      predicted_address: predicted,
      tx: { to: tx.to, data: tx.data, value: tx.value },
      salt: tx.salt,
      receipt,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "launch prepare failed" }, { status: 500 });
  }
}
