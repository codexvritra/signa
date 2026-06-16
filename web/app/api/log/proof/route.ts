import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { tick, inclusionFor } from "@/lib/transparency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/log/proof?message=<uuid>
 *
 * RFC 6962 inclusion proof: prove a specific signed message is committed in
 * the latest transparency-log checkpoint. Returns the leaf, its index, the
 * audit path, and the signed checkpoint (seq/size/root/signature). Verify
 * offline: recompute the root from (leaf_hash, leaf_index, tree_size,
 * audit_path) and confirm it equals checkpoint.root — then check the signer
 * actually signed that root at /api/verify (kind log_checkpoint).
 *
 * Tick first, so a message sent moments ago is covered by a fresh checkpoint.
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(req: NextRequest) {
  const messageId = (req.nextUrl.searchParams.get("message") ?? "").trim();
  if (!UUID.test(messageId)) {
    return NextResponse.json({ ok: false, error: "invalid_message_id" }, { status: 400, headers: CORS });
  }
  const db = serverClient();
  try {
    await tick(db, Date.now());
  } catch {
    /* fall through to whatever the latest checkpoint covers */
  }
  const proof = await inclusionFor(db, messageId);
  if (!proof) {
    return NextResponse.json(
      { ok: false, error: "not_in_log", hint: "message not found, deleted, or not yet checkpointed" },
      { status: 404, headers: CORS },
    );
  }
  return NextResponse.json(
    {
      ok: true,
      ...proof,
      verify: {
        algorithm: "RFC 6962 §2.1.1",
        how: "recompute root from (leaf_hash, leaf_index, tree_size, audit_path); require == checkpoint.root; then POST the checkpoint to /api/verify (kind log_checkpoint) to confirm the signer signed that root.",
        leaf_hash_formula: "SHA256(0x00 || leaf_entry)",
        node_hash_formula: "SHA256(0x01 || left || right)",
      },
    },
    { headers: CORS },
  );
}
