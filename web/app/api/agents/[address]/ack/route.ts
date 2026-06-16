import { NextRequest, NextResponse } from "next/server";
import { serverClient, supabase } from "@/lib/supabase";
import { verifySignedMessage } from "@/lib/verify-signature";
import { buildMessageToSign } from "@/lib/feed-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/agents/[address]/ack — signed delivery acknowledgments (v4.6).
 *
 * The missing half of the message layer. The SENDER signs a DM; here the
 * RECIPIENT signs a receipt — "received" or "read" — for a specific message.
 * A conversation is then provable from BOTH sides: "delivered" stops being a
 * server flag and becomes a wallet signature anyone can re-verify.
 *
 * [address] in the URL is the ACKER = the DM's recipient (the signer). You can
 * only ack a message that was addressed to you; the server confirms
 * agent_dms.to_address == [address] before recording.
 *
 * POST — record a signed ack. Body: { message, status?, ts, signature }.
 *        `status` is "received" (default) or "read". Idempotent per
 *        (message, acker, status). Returns the stored ack + a re-verify
 *        payload for /api/verify (kind "delivery_ack").
 *
 * GET  — list acks. ?message=<id> → all acks for one message. Otherwise
 *        ?role=sent (default) returns delivery receipts for messages this
 *        address SENT ("did my messages land?"); ?role=received returns the
 *        acks this address itself signed.
 *
 * Public, CORS-open, no auth. The wallet signature IS the auth. SIGNA never
 * blocks delivery — an ack is an after-the-fact proof, not a gate.
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

const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(req: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const { address: raw } = await params;
  const acker = (raw ?? "").toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(acker)) {
    return json({ error: "invalid_address" }, { status: 400 });
  }

  let body: { message?: string; status?: string; ts?: number; signature?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, { status: 400 });
  }

  const messageId = String(body.message ?? "").trim();
  const status = (body.status ?? "received").toLowerCase();
  const ts = Number(body.ts ?? 0);
  const signature = String(body.signature ?? "");

  if (!UUID.test(messageId)) {
    return json({ error: "invalid_message_id", hint: "message must be the uuid of an agent_dms row" }, { status: 400 });
  }
  if (status !== "received" && status !== "read") {
    return json({ error: "invalid_status_must_be_received_or_read" }, { status: 400 });
  }

  const db = serverClient();

  // The message must exist AND be addressed to the acker — you can only sign a
  // receipt for a message YOU received.
  const { data: dm } = await db
    .from("agent_dms")
    .select("id, from_address, to_address")
    .eq("id", messageId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!dm) {
    return json({ error: "message_not_found" }, { status: 404 });
  }
  if ((dm.to_address ?? "").toLowerCase() !== acker) {
    return json(
      { error: "not_your_message", hint: "only the recipient (agent_dms.to_address) can ack a message" },
      { status: 403 },
    );
  }
  const counterparty = (dm.from_address ?? "").toLowerCase();

  // Rebuild the canonical preimage and verify the acker actually signed it.
  const message = buildMessageToSign({
    kind: "agent_dm_ack",
    message: messageId,
    from: acker,
    to: counterparty,
    status: status as "received" | "read",
    ts,
  });
  const verify = await verifySignedMessage({ expectedAddress: acker, message, signature, ts });
  if (!verify.ok) {
    return json({ error: verify.reason }, { status: 401 });
  }

  // Idempotent insert. The unique (message_id, acker, status) constraint means
  // a re-submitted ack is a no-op; we then return the stored row either way.
  await db
    .from("agent_dm_acks")
    .upsert(
      {
        message_id: messageId,
        acker,
        counterparty,
        status,
        ts,
        signature,
        signed_message: message,
      },
      { onConflict: "message_id,acker,status", ignoreDuplicates: true },
    );

  const { data: stored } = await db
    .from("agent_dm_acks")
    .select("id, message_id, acker, counterparty, status, ts, signature, created_at")
    .eq("message_id", messageId)
    .eq("acker", acker)
    .eq("status", status)
    .maybeSingle();

  return json({
    ok: true,
    ack: stored,
    // everything needed to re-verify offline / at /api/verify — no trust in SIGNA
    reverify: {
      kind: "delivery_ack",
      ts,
      message: messageId,
      from: acker,
      to: counterparty,
      status,
      signature,
    },
    verify: `${req.nextUrl.origin}/api/verify`,
    note: "Delivery receipt recorded. The recipient signed it — re-verify at /api/verify (kind delivery_ack). SIGNA never blocks delivery; this is after-the-fact proof.",
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const { address: raw } = await params;
  const addr = (raw ?? "").toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(addr)) {
    return json({ error: "invalid_address" }, { status: 400 });
  }
  const sp = req.nextUrl.searchParams;
  const messageId = sp.get("message");
  const role = (sp.get("role") ?? "sent").toLowerCase();
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 50), 1), 200);

  let q = supabase
    .from("agent_dm_acks")
    .select("id, message_id, acker, counterparty, status, ts, signature, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (messageId && UUID.test(messageId)) {
    q = q.eq("message_id", messageId);
  } else if (role === "received") {
    q = q.eq("acker", addr); // acks this address signed
  } else {
    q = q.eq("counterparty", addr); // delivery receipts for messages this address SENT
  }

  const { data, error } = await q;
  if (error) {
    return json({ error: error.message }, { status: 500 });
  }
  return json({
    ok: true,
    address: addr,
    role: messageId ? "message" : role,
    count: data?.length ?? 0,
    acks: data ?? [],
  });
}
