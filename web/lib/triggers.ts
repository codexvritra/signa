/**
 * SIGNA Triggers — wallet-signed conditional agent automations.
 *
 * An agent signs a rule: WHEN <verifiable condition> DO <action>. SIGNA
 * evaluates the condition against real network signals and, when it's met,
 * fires the action via a deterministic executor identity that carries the
 * owner's signature as authorization. The owner signs the *promise*; the
 * executor signs the *keeping* of it; every firing lands in the network ledger
 * (it's an ordinary signed DM). SIGNA never holds the owner's key — it can't
 * forge the rule, only execute the one the owner signed.
 *
 * Conditions (v1):
 *   time       { at }                      — fire at/after a timestamp
 *   received   { from }                    — fire when the owner receives a DM from `from`
 *   capability { cap, arg?, field, op, value } — invoke a capability, compare a field
 * Action (v1):
 *   notify     { to?, body }               — executor sends a signed DM (default to the owner)
 */
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, toBytes } from "viem";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildMessageToSign, DEFAULT_DM_PROTOCOL } from "./feed-types";
import { fulfillCapability } from "./capabilities";

export const TRIGGER_EXECUTOR_ACCOUNT = privateKeyToAccount(keccak256(toBytes("signa:trigger-executor:v1")));
export const TRIGGER_EXECUTOR = TRIGGER_EXECUTOR_ACCOUNT.address.toLowerCase();

/** Canonical flat-object encoding for the signed preimage (sorted keys). */
export function canon(obj: Record<string, unknown> = {}): string {
  return Object.keys(obj)
    .sort()
    .map((k) => `${k}=${typeof obj[k] === "string" ? obj[k] : JSON.stringify(obj[k])}`)
    .join(";");
}

/** The canonical preimage the owner signs to arm a trigger. */
export function triggerPreimage(a: {
  ts: number;
  owner: string;
  when_type: string;
  trigger: Record<string, unknown>;
  do_type: string;
  action: Record<string, unknown>;
  expiry?: string | null;
}): string {
  return [
    "SIGNA trigger v1",
    `ts:${a.ts}`,
    `owner:${a.owner.toLowerCase()}`,
    `when:${a.when_type}:${canon(a.trigger)}`,
    `do:${a.do_type}:${canon(a.action)}`,
    `expiry:${a.expiry ?? ""}`,
  ].join("\n");
}

export type TriggerRow = {
  id: string;
  owner: string;
  when_type: string;
  trigger: Record<string, unknown>;
  do_type: string;
  action: Record<string, unknown>;
  expiry: string | null;
  status: string;
  ts: number;
  created_at: string;
};

function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
}

/** Evaluate a trigger's condition. Returns a reason string if it should fire, else null. */
export async function evalTrigger(db: SupabaseClient, t: TriggerRow): Promise<string | null> {
  try {
    if (t.when_type === "time") {
      const at = String(t.trigger.at ?? "");
      if (at && Date.now() >= new Date(at).getTime()) return `time reached (${at})`;
      return null;
    }
    if (t.when_type === "received") {
      const from = String(t.trigger.from ?? "").toLowerCase();
      if (!/^0x[a-f0-9]{40}$/.test(from)) return null;
      const { data } = await db
        .from("agent_dms")
        .select("id")
        .eq("to_address", t.owner)
        .eq("from_address", from)
        .gt("created_at", t.created_at)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();
      return data ? `received a DM from ${from}` : null;
    }
    if (t.when_type === "capability") {
      const cap = String(t.trigger.cap ?? "");
      const arg = t.trigger.arg != null ? String(t.trigger.arg) : "";
      const field = String(t.trigger.field ?? "");
      const op = String(t.trigger.op ?? "");
      const target = Number(t.trigger.value);
      const out = await fulfillCapability(cap, arg);
      const raw = field ? getPath(out, field) : out;
      const val = Number(raw);
      if (!Number.isFinite(val) || !Number.isFinite(target)) return null;
      const hit = op === ">" ? val > target : op === "<" ? val < target : op === ">=" ? val >= target : op === "<=" ? val <= target : op === "==" ? val === target : false;
      return hit ? `${cap}.${field} (${val}) ${op} ${target}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

/** Fire a trigger: execute its action via the executor, mark it fired. */
export async function fire(db: SupabaseClient, t: TriggerRow, reason: string): Promise<{ ok: boolean; dm_id?: string; error?: string }> {
  if (t.do_type !== "notify") return { ok: false, error: "unsupported_action" };
  const to = String((t.action.to as string) ?? t.owner).toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(to)) return { ok: false, error: "bad_target" };
  const baseBody = String(t.action.body ?? "trigger fired").slice(0, 1500);
  const body = `${baseBody}\n\n— SIGNA trigger ${t.id.slice(0, 8)} fired: ${reason}. Authorized by ${t.owner} (rule signed ${new Date(t.ts).toISOString()}).`;
  const ts = Date.now();
  const message = buildMessageToSign({ kind: "agent_dm", from: TRIGGER_EXECUTOR, to, body, ts });
  const signature = await TRIGGER_EXECUTOR_ACCOUNT.signMessage({ message });

  const { data: dm, error } = await db
    .from("agent_dms")
    .insert({
      from_address: TRIGGER_EXECUTOR,
      to_address: to,
      body,
      body_type: "text",
      protocol: DEFAULT_DM_PROTOCOL,
      ts,
      signature,
      signed_message: message,
    })
    .select("id")
    .single();
  if (error || !dm) return { ok: false, error: error?.message ?? "insert_failed" };

  await db
    .from("signa_triggers")
    .update({ status: "fired", fired_at: new Date().toISOString(), fire_reason: reason, fire_dm_id: dm.id })
    .eq("id", t.id);
  return { ok: true, dm_id: dm.id };
}

/** Evaluate all armed triggers; expire the lapsed, fire the met. */
export async function tickTriggers(db: SupabaseClient): Promise<{ evaluated: number; fired: number; expired: number }> {
  const { data } = await db
    .from("signa_triggers")
    .select("id, owner, when_type, trigger, do_type, action, expiry, status, ts, created_at")
    .eq("status", "armed")
    .order("created_at", { ascending: true })
    .limit(100);
  const rows = (data ?? []) as TriggerRow[];
  let fired = 0;
  let expired = 0;
  const nowIso = new Date().toISOString();
  for (const t of rows) {
    if (t.expiry && t.expiry < nowIso) {
      await db.from("signa_triggers").update({ status: "expired" }).eq("id", t.id);
      expired++;
      continue;
    }
    const reason = await evalTrigger(db, t);
    if (reason) {
      const r = await fire(db, t, reason);
      if (r.ok) fired++;
    }
  }
  return { evaluated: rows.length, fired, expired };
}
