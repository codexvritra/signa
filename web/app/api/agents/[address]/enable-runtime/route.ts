import { NextRequest, NextResponse } from "next/server";
import { privateKeyToAccount } from "viem/accounts";
import { serverClient } from "@/lib/supabase";
import { verifySignedMessage } from "@/lib/verify-signature";
import { buildMessageToSign } from "@/lib/feed-types";
import { encryptAgentKey } from "@/lib/key-vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/agents/[address]/enable-runtime
 *
 * Body: { ts, signature, agent_private_key }
 *
 * The agent's private key is sent in plaintext over HTTPS once. We
 * immediately:
 *   1. Derive the address from the private key locally and verify it
 *      matches the URL `[address]` segment — proves the caller has the
 *      key, not just a stolen address.
 *   2. Verify the `agent_runtime_enable` signed message from that
 *      address — proves the call is intentional, not a replay.
 *   3. Encrypt the private key with AES-256-GCM via key-vault using
 *      the server-side AGENT_RUNTIME_MASTER_KEY env var.
 *   4. Store the ciphertext + flip runtime_enabled = true on the row.
 *
 * The plaintext key is never logged, never persisted, never returned.
 * Once the response leaves the function the buffer goes out of scope.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address: raw } = await params;
    const address = raw.toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: "invalid_address" }, { status: 400 });
    }

    let body: {
      ts?: number;
      signature?: string;
      agent_private_key?: string;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "bad_json" }, { status: 400 });
    }

    const ts = body.ts ?? 0;
    const signature = body.signature ?? "";
    const rawPk = (body.agent_private_key ?? "").trim();
    if (!rawPk) {
      return NextResponse.json(
        { error: "agent_private_key required" },
        { status: 400 },
      );
    }
    const pk = (rawPk.startsWith("0x") ? rawPk : `0x${rawPk}`) as `0x${string}`;
    if (!/^0x[a-fA-F0-9]{64}$/.test(pk)) {
      return NextResponse.json(
        {
          error:
            "agent_private_key must be 32 raw bytes (64 hex chars, 0x optional)",
        },
        { status: 400 },
      );
    }

    // (1) Derive address from the key locally and confirm match.
    let derivedAddress: string;
    try {
      const acct = privateKeyToAccount(pk);
      derivedAddress = acct.address.toLowerCase();
    } catch (e) {
      return NextResponse.json(
        {
          error: "invalid_private_key",
          message: e instanceof Error ? e.message : String(e),
        },
        { status: 400 },
      );
    }
    if (derivedAddress !== address) {
      return NextResponse.json(
        {
          error: "key_address_mismatch",
          message: `Private key derives to ${derivedAddress}, not ${address}.`,
        },
        { status: 403 },
      );
    }

    // (2) Verify the signed enable message came from the agent wallet.
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

    // (3) Encrypt the private key.
    let encryptedKey: string;
    try {
      encryptedKey = encryptAgentKey(pk);
    } catch (e) {
      return NextResponse.json(
        {
          error: "vault_misconfigured",
          message: e instanceof Error ? e.message : String(e),
        },
        { status: 500 },
      );
    }

    // (4) Persist.
    const db = serverClient();
    const now = new Date().toISOString();
    const { data, error } = await db
      .from("agents")
      .update({
        encrypted_key: encryptedKey,
        runtime_enabled: true,
        runtime_enabled_at: now,
        updated_at: now,
      })
      .eq("address", address)
      .is("deleted_at", null)
      .select("address, name, runtime_enabled, runtime_enabled_at")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "persist_failed" },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, agent: data });
  } catch (e) {
    return NextResponse.json(
      {
        error: "internal",
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
