import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { verifySignedMessage } from "@/lib/verify-signature";
import { buildMessageToSign } from "@/lib/feed-types";
import { encryptOpaque } from "@/lib/key-vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/me/bankr-key
 *
 * Body:
 *   { address, connect: true,  api_key: 'bk_…', ts, signature }   ← connect
 *   { address, connect: false, ts, signature }                     ← disconnect + purge
 *
 * Wallet-signed connect/disconnect for the user's personal Bankr Agent API
 * key. When connected, /trade commands typed in any SIGNA chat or
 * composer will execute via Bankr's /agent/prompt against the user's
 * Bankr-managed wallet.
 *
 * The key is encrypted server-side with AES-256-GCM via the existing
 * AGENT_RUNTIME_MASTER_KEY vault (same one we use for custodial agent
 * private keys). The plaintext never persists.
 */
export async function POST(req: NextRequest) {
  let body: {
    address?: string;
    connect?: boolean;
    api_key?: string;
    ts?: number;
    signature?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const address = (body.address ?? "").toLowerCase();
  const connect = body.connect !== false;
  const apiKey = (body.api_key ?? "").trim();
  const ts = body.ts ?? 0;
  const signature = body.signature ?? "";

  if (!/^0x[a-f0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "invalid_address" }, { status: 400 });
  }
  if (connect && !/^bk_[A-Za-z0-9_-]{20,}$/.test(apiKey)) {
    return NextResponse.json(
      {
        error: "invalid_bankr_key",
        message: "Bankr Agent API key must start with bk_ and be ≥24 chars",
      },
      { status: 400 },
    );
  }

  const message = buildMessageToSign({
    kind: "bankr_connect",
    address,
    connect,
    ts,
  });
  const verify = await verifySignedMessage({
    expectedAddress: address,
    message,
    signature,
    ts,
  });
  if (!verify.ok) {
    return NextResponse.json({ error: verify.reason }, { status: 401 });
  }

  const db = serverClient();
  const now = new Date().toISOString();

  if (!connect) {
    const { error } = await db
      .from("users")
      .update({
        bankr_api_key_encrypted: null,
        bankr_connected_at: null,
        bankr_last_used_at: null,
        updated_at: now,
      })
      .eq("address", address);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, disconnected: true });
  }

  // Verify the key works BEFORE storing — call /wallet/me as a cheap auth check.
  try {
    const me = await fetch("https://api.bankr.bot/wallet/me", {
      headers: { "X-API-Key": apiKey, accept: "application/json" },
    });
    if (!me.ok) {
      const body = await me.text().catch(() => "");
      return NextResponse.json(
        {
          error: "bankr_rejected_key",
          status: me.status,
          message:
            "Bankr rejected this key. Confirm it's an Agent API key (starts with bk_) and that it's still active.",
          bankr_body: body.slice(0, 200),
        },
        { status: 401 },
      );
    }
  } catch (e) {
    return NextResponse.json(
      {
        error: "bankr_unreachable",
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 502 },
    );
  }

  let encrypted: string;
  try {
    encrypted = encryptOpaque(apiKey);
  } catch (e) {
    return NextResponse.json(
      {
        error: "vault_misconfigured",
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }

  const { error } = await db.from("users").upsert(
    {
      address,
      bankr_api_key_encrypted: encrypted,
      bankr_connected_at: now,
      updated_at: now,
    },
    { onConflict: "address" },
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, connected: true });
}

/** GET /api/me/bankr-key?address=… → { connected, connected_at, last_used_at } */
export async function GET(req: NextRequest) {
  const address = (req.nextUrl.searchParams.get("address") ?? "")
    .trim()
    .toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "invalid_address" }, { status: 400 });
  }
  const { data } = await serverClient()
    .from("users")
    .select("bankr_api_key_encrypted, bankr_connected_at, bankr_last_used_at")
    .eq("address", address)
    .maybeSingle();
  return NextResponse.json({
    ok: true,
    connected: !!data?.bankr_api_key_encrypted,
    connected_at: data?.bankr_connected_at ?? null,
    last_used_at: data?.bankr_last_used_at ?? null,
  });
}
