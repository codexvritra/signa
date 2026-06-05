import { NextRequest, NextResponse } from "next/server";
import { serverClient, supabase } from "@/lib/supabase";
import { verifySignedMessage } from "@/lib/verify-signature";
import { mandatePreimage, USDC_BASE, NETWORK_BASE } from "@/lib/mandate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/mandates — a human grants a bounded, wallet-signed spending budget to an
 * agent. The signature recovers to the grantor, so the authority is provable and
 * re-verifiable. POST to issue; GET for recent (optionally ?agent=).
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
const json = (b: unknown, i?: ResponseInit) =>
  NextResponse.json(b, { ...i, headers: { ...(i?.headers ?? {}), ...CORS } });

export async function GET(req: NextRequest) {
  const agent = (req.nextUrl.searchParams.get("agent") ?? "").toLowerCase();
  let q = supabase
    .from("spend_mandates")
    .select("id, grantor, agent, asset, network, limit_raw, per_tx_raw, expiry, memo, signed_message, signature, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  if (/^0x[a-f0-9]{40}$/.test(agent)) q = q.eq("agent", agent);
  const { data, error } = await q;
  if (error) return json({ ok: false, error: error.message }, { status: 500 });
  return json({ ok: true, mandates: data ?? [] });
}

export async function POST(req: NextRequest) {
  let b: any;
  try {
    b = await req.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const grantor = String(b.grantor ?? "").toLowerCase();
  const agent = String(b.agent ?? "").toLowerCase();
  const asset = String(b.asset ?? USDC_BASE).toLowerCase();
  const network = String(b.network ?? NETWORK_BASE);
  const limit = String(b.limit ?? "");
  const perTx = String(b.per_tx ?? "");
  const expiry = Number(b.expiry ?? 0);
  const memo = b.memo != null ? String(b.memo).slice(0, 280) : "";
  const ts = Number(b.ts ?? 0);
  const signature = String(b.signature ?? "");

  if (!/^0x[a-f0-9]{40}$/.test(grantor)) return json({ ok: false, error: "invalid_grantor" }, { status: 400 });
  if (!/^0x[a-f0-9]{40}$/.test(agent)) return json({ ok: false, error: "invalid_agent" }, { status: 400 });
  if (grantor === agent) return json({ ok: false, error: "grantor_and_agent_must_differ" }, { status: 400 });
  let lim: bigint, ptx: bigint;
  try {
    lim = BigInt(limit);
    ptx = BigInt(perTx);
  } catch {
    return json({ ok: false, error: "invalid_amounts" }, { status: 400 });
  }
  if (lim <= 0n || ptx <= 0n || ptx > lim) return json({ ok: false, error: "bad_limits" }, { status: 400 });
  if (!Number.isFinite(expiry) || expiry < Math.floor(Date.now() / 1000)) {
    return json({ ok: false, error: "expiry_in_past" }, { status: 400 });
  }

  const message = mandatePreimage({ ts, grantor, agent, asset, network, limit, perTx, expiry, memo });
  const v = await verifySignedMessage({ expectedAddress: grantor, message, signature, ts });
  if (!v.ok) return json({ ok: false, error: v.reason }, { status: 401 });

  const { data, error } = await serverClient()
    .from("spend_mandates")
    .insert({
      grantor, agent, asset, network,
      limit_raw: limit, per_tx_raw: perTx, expiry, memo,
      signed_message: message, signature,
    })
    .select("id, grantor, agent, asset, network, limit_raw, per_tx_raw, expiry, memo, created_at")
    .single();
  if (error || !data) return json({ ok: false, error: error?.message ?? "insert_failed" }, { status: 500 });
  return json({ ok: true, mandate: data });
}
