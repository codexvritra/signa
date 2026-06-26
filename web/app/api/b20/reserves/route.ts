import { NextRequest, NextResponse } from "next/server";
import { B20_NETWORK, buildB20Reserves, type B20ReservesFields } from "@/lib/b20";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/b20/reserves — verifiable stablecoins on B20.
 *
 * B20 ships a native STABLECOIN variant. This endpoint builds an unsigned reserve
 * attestation: the canonical preimage the ISSUER signs ("this stablecoin is backed by
 * X of asset Y, as of T"), plus the reverify payload. The issuer signs, then anyone
 * re-checks via /api/verify (kind b20_reserves), recovering the issuer. This is provenance
 * of the issuer's claim — who attested, what, and when — not a third-party audit. SIGNA holds no key.
 *
 * POST { token, issuer, reserve_amount, reserve_asset, statement, as_of? }
 */

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
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

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ ok: false, error: "invalid json" }, { status: 400 }); }

  const token = String(body.token ?? "").trim();
  const issuer = String(body.issuer ?? "").trim();
  const reserve_amount = String(body.reserve_amount ?? "").trim();
  const reserve_asset = String(body.reserve_asset ?? "").trim().toUpperCase().replace(/[^A-Z0-9$. ]/g, "").slice(0, 24);
  const statement = String(body.statement ?? "").trim();
  const as_of = Number(body.as_of) || Date.now();
  if (!isAddr(token)) return json({ ok: false, error: "token must be the B20 stablecoin address (0x…40)" }, { status: 400 });
  if (!isAddr(issuer)) return json({ ok: false, error: "issuer must be the issuer wallet (0x…40)" }, { status: 400 });
  if (!/^[\d.,]+$/.test(reserve_amount)) return json({ ok: false, error: "reserve_amount must be a number" }, { status: 400 });
  if (!reserve_asset) return json({ ok: false, error: "reserve_asset required (e.g. USDC, USD)" }, { status: 400 });
  if (!statement || statement.length > 500) return json({ ok: false, error: "statement required (≤500 chars)" }, { status: 400 });

  const fields: B20ReservesFields = { ts: Date.now(), token, issuer, reserve_amount, reserve_asset, statement, as_of };
  try {
    const built = buildB20Reserves(fields);
    return json({
      ok: true,
      network: B20_NETWORK,
      ...fields,
      preimage: built.preimage,         // the issuer signs THIS (EIP-191 personal_sign)
      statement_hash: built.statement_hash,
      reverify: built.reverify,         // add `signature` after signing, POST to /api/verify
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "attestation build failed" }, { status: 500 });
  }
}
