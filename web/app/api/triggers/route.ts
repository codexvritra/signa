import { NextRequest, NextResponse } from "next/server";
import { serverClient, supabase } from "@/lib/supabase";
import { verifySignedMessage } from "@/lib/verify-signature";
import { triggerPreimage, tickTriggers, TRIGGER_EXECUTOR } from "@/lib/triggers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/triggers — wallet-signed conditional agent automations.
 *
 * POST  arm a rule: { owner, when_type, trigger, do_type, action, expiry?, ts,
 *       signature }. The signature is the owner's EIP-191 over the canonical
 *       trigger preimage — an authentic, attributable promise.
 * GET   list triggers (?owner= &status= &limit=). Reading lazily EVALUATES armed
 *       triggers and fires the ones whose condition is met, so the network
 *       advances with zero cron.
 *
 * Conditions: time {at} · received {from} · capability {cap,arg?,field,op,value}
 * Action:     notify {to?, body}  (executor sends a signed DM, logged to the ledger)
 *
 * Keyless: SIGNA never holds the owner's key. The owner signs the rule; the
 * deterministic executor signs each firing and carries the owner's signature
 * as authorization. Re-verify a rule at /api/verify (kind "trigger").
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
function json(b: unknown, init?: ResponseInit) {
  return NextResponse.json(b, { ...init, headers: { ...(init?.headers ?? {}), ...CORS } });
}

const WHEN = new Set(["time", "received", "capability"]);
const DO = new Set(["notify"]);

export async function POST(req: NextRequest) {
  let b: {
    owner?: string; when_type?: string; trigger?: Record<string, unknown>;
    do_type?: string; action?: Record<string, unknown>; expiry?: string | null;
    ts?: number; signature?: string;
  };
  try { b = await req.json(); } catch { return json({ error: "bad_json" }, { status: 400 }); }

  const owner = (b.owner ?? "").toLowerCase();
  const when_type = String(b.when_type ?? "");
  const do_type = String(b.do_type ?? "");
  const trigger = b.trigger ?? {};
  const action = b.action ?? {};
  const expiry = b.expiry ?? null;
  const ts = Number(b.ts ?? 0);
  const signature = String(b.signature ?? "");

  if (!/^0x[a-f0-9]{40}$/.test(owner)) return json({ error: "invalid_owner" }, { status: 400 });
  if (!WHEN.has(when_type)) return json({ error: "invalid_when_type", allowed: [...WHEN] }, { status: 400 });
  if (!DO.has(do_type)) return json({ error: "invalid_do_type", allowed: [...DO] }, { status: 400 });
  if (typeof trigger !== "object" || typeof action !== "object") return json({ error: "trigger_and_action_must_be_objects" }, { status: 400 });

  const message = triggerPreimage({ ts, owner, when_type, trigger, do_type, action, expiry });
  const verify = await verifySignedMessage({ expectedAddress: owner, message, signature, ts });
  if (!verify.ok) return json({ error: verify.reason }, { status: 401 });

  const db = serverClient();
  const { data, error } = await db
    .from("signa_triggers")
    .insert({ owner, when_type, trigger, do_type, action, expiry, status: "armed", ts, signature, signed_message: message })
    .select("id, owner, when_type, trigger, do_type, action, expiry, status, ts, created_at")
    .single();
  if (error || !data) return json({ error: error?.message ?? "insert_failed" }, { status: 500 });

  return json({
    ok: true,
    trigger: data,
    executor: TRIGGER_EXECUTOR,
    reverify: { kind: "trigger", ts, owner, when_type, trigger, do_type, action, expiry, signature },
    note: "Armed. SIGNA will fire it when the condition is met; the firing is an executor-signed DM in the ledger. SIGNA never holds your key.",
  });
}

export async function GET(req: NextRequest) {
  // lazy-evaluate armed triggers on read so the network advances without cron
  let ticked = { evaluated: 0, fired: 0, expired: 0 };
  try { ticked = await tickTriggers(serverClient()); } catch { /* best effort */ }

  const sp = req.nextUrl.searchParams;
  const owner = (sp.get("owner") ?? "").toLowerCase();
  const status = sp.get("status");
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 50), 1), 200);

  let q = supabase
    .from("signa_triggers")
    .select("id, owner, when_type, trigger, do_type, action, expiry, status, ts, created_at, fired_at, fire_reason, fire_dm_id")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (/^0x[a-f0-9]{40}$/.test(owner)) q = q.eq("owner", owner);
  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return json({ error: error.message }, { status: 500 });
  return json({ ok: true, executor: TRIGGER_EXECUTOR, ticked, count: data?.length ?? 0, triggers: data ?? [] });
}
