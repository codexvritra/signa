import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { verifySignedMessage } from "@/lib/verify-signature";
import { buildMessageToSign } from "@/lib/feed-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Idempotent register. Called when a user enables XMTP via SIGNA so they
 * become tag-able in @mention autocomplete. Updates basename + ens_name
 * on subsequent calls. Requires a signature to prevent random scripts
 * filling the users table.
 */
export async function POST(req: NextRequest) {
  let body: {
    address?: string;
    basename?: string | null;
    ens_name?: string | null;
    ts?: number;
    signature?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const address = (body.address ?? "").toLowerCase();
  const basename = body.basename?.trim() || null;
  const ens_name = body.ens_name?.trim() || null;
  const ts = body.ts ?? 0;
  const signature = body.signature ?? "";

  const message = buildMessageToSign({
    kind: "register",
    address,
    basename,
    ens_name,
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
  const { error } = await db
    .from("users")
    .upsert(
      {
        address: verify.address,
        basename,
        ens_name,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "address" },
    );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
