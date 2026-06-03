import { NextRequest, NextResponse } from "next/server";
import { serverClient, supabase } from "@/lib/supabase";
import { verifySignedMessage } from "@/lib/verify-signature";
import { notePreimage, NOTE_MAX_BODY, sanitizeTo } from "@/lib/note";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/notes
 *
 * The public "signed note" primitive behind the SIGNA Mini App. A note is a
 * short statement signed by a wallet (EIP-191). Sending one is a single
 * signature — no account, no key custody. The signature IS the proof.
 *
 * POST — create a note. Body MUST carry a valid wallet signature over the
 *        canonical preimage; we verify before persisting. fid/username are
 *        optional context from the Farcaster client (untrusted, display only).
 * GET  — recent notes (public wall), newest first.
 *
 * Public, CORS-open, no auth. Per-signer rate limit: 30 notes / hour.
 */

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
} as const;

const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 30;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

function json(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...(init?.headers ?? {}), ...CORS },
  });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Number(sp.get("limit") ?? 12), 50);
  const to = sanitizeTo(sp.get("to"));
  let q = supabase
    .from("signed_notes")
    .select("id, address, fid, username, to_label, body, ts, signature, signed_message, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  // ?to=<handle> => a specific inbox; otherwise the public broadcast wall.
  if (to) q = q.eq("to_label", to);
  else q = q.is("to_label", null);
  const { data, error } = await q;
  if (error) return json({ ok: false, error: error.message }, { status: 500 });
  return json({ ok: true, count: data?.length ?? 0, to: to ?? null, notes: data ?? [] });
}

export async function POST(req: NextRequest) {
  let body: {
    address?: string;
    body?: string;
    ts?: number;
    signature?: string;
    fid?: number | null;
    username?: string | null;
    to?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const address = (body.address ?? "").toLowerCase();
  const content = (body.body ?? "").trim();
  const ts = Number(body.ts ?? 0);
  const signature = String(body.signature ?? "");
  const toLabel = sanitizeTo(body.to ?? null);
  const fid =
    body.fid != null && Number.isFinite(Number(body.fid)) ? Number(body.fid) : null;
  const username =
    typeof body.username === "string" && body.username.trim().length > 0
      ? body.username.trim().slice(0, 64)
      : null;

  if (!/^0x[a-f0-9]{40}$/.test(address)) {
    return json({ ok: false, error: "invalid_address" }, { status: 400 });
  }
  if (content.length < 1 || content.length > NOTE_MAX_BODY) {
    return json(
      { ok: false, error: "body_length_out_of_range", hint: `1..${NOTE_MAX_BODY} chars` },
      { status: 400 },
    );
  }

  // Verify the wallet signature against the canonical preimage BEFORE persisting.
  const message = notePreimage({ address, ts, body: content, to: toLabel });
  const verify = await verifySignedMessage({
    expectedAddress: address,
    message,
    signature,
    ts,
  });
  if (!verify.ok) {
    return json({ ok: false, error: verify.reason }, { status: 401 });
  }

  const db = serverClient();

  // Per-signer rate limit.
  const cutoff = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count } = await db
    .from("signed_notes")
    .select("id", { count: "exact", head: true })
    .eq("address", address)
    .gte("created_at", cutoff);
  if ((count ?? 0) >= RATE_MAX) {
    return json(
      { ok: false, error: "rate_limited", hint: `max ${RATE_MAX} notes per hour per wallet` },
      { status: 429 },
    );
  }

  const { data: inserted, error: insErr } = await db
    .from("signed_notes")
    .insert({
      address,
      fid,
      username,
      to_label: toLabel,
      body: content,
      ts,
      signature,
      signed_message: message,
    })
    .select("id, address, fid, username, to_label, body, ts, signature, signed_message, created_at")
    .single();

  if (insErr || !inserted) {
    return json({ ok: false, error: insErr?.message ?? "insert_failed" }, { status: 500 });
  }

  return json({ ok: true, note: inserted });
}
