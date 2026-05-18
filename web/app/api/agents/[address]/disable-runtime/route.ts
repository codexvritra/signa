import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { verifySignedMessage } from "@/lib/verify-signature";
import { buildMessageToSign } from "@/lib/feed-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/agents/[address]/disable-runtime
 *
 * Body: { ts, signature }
 *
 * Signed by the agent wallet (same agent_runtime_enable message — we
 * reuse it; the act of signing the message at any point in time is the
 * signal of intent). Flips runtime_enabled = false, leaves the
 * encrypted key in place so re-enable doesn't require another paste.
 *
 * To FULLY wipe the encrypted key, the caller can POST with
 * ?purge=true in the URL — that sets encrypted_key = null too.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address: raw } = await params;
  const address = raw.toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "invalid_address" }, { status: 400 });
  }

  let body: { ts?: number; signature?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const ts = body.ts ?? 0;
  const signature = body.signature ?? "";

  const message = buildMessageToSign({
    kind: "agent_runtime_enable",
    address,
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

  const purge = req.nextUrl.searchParams.get("purge") === "true";
  const db = serverClient();
  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    runtime_enabled: false,
    updated_at: now,
  };
  if (purge) update.encrypted_key = null;

  const { error } = await db
    .from("agents")
    .update(update)
    .eq("address", address);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, purged: purge });
}
