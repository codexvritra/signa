import { NextRequest, NextResponse } from "next/server";
import { serverClient, supabase } from "@/lib/supabase";
import { verifySignedMessage } from "@/lib/verify-signature";
import { buildMessageToSign } from "@/lib/feed-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/agents/[address] — single agent profile, with full launchpad
 * stack metadata. Returns 404 if the agent doesn't exist or has been
 * soft-deleted.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address: raw } = await params;
  const address = raw.toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "invalid_address" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("agents")
    .select(
      "address, name, description, tags, verified, submitted_at, system_prompt, avatar_seed, launched_at, launched_by, gitlawb_did, erc8004_token_id, bankr_token_address, miroshark_sim_id",
    )
    .eq("address", address)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ agent: data });
}

/**
 * DELETE /api/agents/[address] — soft-delete an agent listing.
 * Must be signed by the agent's wallet itself.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address: raw } = await params;
  const address = raw.toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }

  let body: { ts?: number; signature?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const ts = body.ts ?? 0;
  const signature = body.signature ?? "";

  const message = buildMessageToSign({ kind: "agent_delete", address, ts });
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
    .from("agents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("address", address);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
