import { NextRequest, NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { registerPreimage, validName, isSafeEndpoint, saveCapability } from "@/lib/marketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/capabilities/register
 *
 * Publish a capability to the open marketplace with ONE wallet-signed call.
 * No signup, no API key — the provider wallet is the only credential. Once
 * registered, the capability is discoverable in the directory, callable by
 * any agent and by the brain at /api/capabilities/invoke?cap=<name>, and
 * (optionally) priced in USDC.
 *
 * Body: {
 *   name, endpoint, method?, description, input_hint?, price_usdc?, pay_to?,
 *   provider, ts, signature
 * }
 * signature = EIP-191 over registerPreimage(...) signed by `provider`.
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  let b: any = {};
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400, headers: CORS }); }

  const name = String(b.name ?? "").trim();
  const endpoint = String(b.endpoint ?? "").trim();
  const method = String(b.method ?? "GET").toUpperCase();
  const description = String(b.description ?? "").slice(0, 300);
  const input_hint = b.input_hint ? String(b.input_hint).slice(0, 120) : undefined;
  const price_usdc = Number(b.price_usdc ?? 0) || 0;
  const pay_to = b.pay_to ? String(b.pay_to).toLowerCase() : undefined;
  const provider = String(b.provider ?? "").toLowerCase();
  const ts = Number(b.ts ?? 0);
  const signature = String(b.signature ?? "");

  if (!validName(name)) return NextResponse.json({ ok: false, error: "invalid_name", hint: "use a namespaced name like myteam.summarize; reserved/built-in names are blocked" }, { status: 400, headers: CORS });
  if (!isSafeEndpoint(endpoint)) return NextResponse.json({ ok: false, error: "invalid_endpoint", hint: "must be an https public URL (no localhost/private IPs)" }, { status: 400, headers: CORS });
  if (!["GET", "POST"].includes(method)) return NextResponse.json({ ok: false, error: "invalid_method" }, { status: 400, headers: CORS });
  if (!/^0x[a-f0-9]{40}$/.test(provider)) return NextResponse.json({ ok: false, error: "invalid_provider" }, { status: 400, headers: CORS });
  if (!ts || Math.abs(Date.now() - ts) > 10 * 60 * 1000) return NextResponse.json({ ok: false, error: "stale_ts" }, { status: 400, headers: CORS });
  if (price_usdc < 0 || price_usdc > 100) return NextResponse.json({ ok: false, error: "invalid_price" }, { status: 400, headers: CORS });

  // verify the provider actually signed this registration
  let sigOk = false;
  try {
    sigOk = await verifyMessage({
      address: provider as `0x${string}`,
      message: registerPreimage({ ts, name, provider, endpoint, method, price: price_usdc }),
      signature: signature as `0x${string}`,
    });
  } catch { sigOk = false; }
  if (!sigOk) return NextResponse.json({ ok: false, error: "bad_signature" }, { status: 401, headers: CORS });

  const saved = await saveCapability({ name, provider_address: provider, endpoint, method, description, input_hint, price_usdc, pay_to, ts, signature });
  if (!saved.ok) return NextResponse.json({ ok: false, error: saved.error }, { status: 409, headers: CORS });

  return NextResponse.json(
    {
      ok: true,
      name,
      provider,
      invoke: `/api/capabilities/invoke?cap=${encodeURIComponent(name)}`,
      directory: `/api/capabilities`,
      note: "Live now. Callable by any agent and by the brain. Anyone can re-verify your registration signature with viem.",
    },
    { headers: CORS },
  );
}
