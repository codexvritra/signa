/**
 * v4.6 — Signed delivery acknowledgments.
 *
 * The SENDER of a DM signs the message. With this module the RECIPIENT signs
 * a receipt ("received" / "read") for a specific message, so a conversation
 * is provable from BOTH sides. "Delivered" stops being a server flag and
 * becomes a wallet signature anyone can re-verify at /api/verify (kind
 * "delivery_ack"). Acks federate exactly like agent_dms — same canonical
 * envelope, no central authority required.
 *
 * This file is read-only helpers; the write path (verify signature + insert)
 * lives in /api/agents/[address]/ack.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type AckRow = {
  id: string;
  message_id: string;
  acker: string;
  counterparty: string;
  status: "received" | "read";
  ts: number;
  signature: string;
  signed_message: string;
  created_at: string;
};

/** Per-message delivery status, derived from the signed ack rows. */
export type DeliveryStatus = {
  state: "sent" | "received" | "read";
  received_at: string | null;
  read_at: string | null;
  /** the signature(s) backing the status, so a reader can re-verify */
  proofs: { status: "received" | "read"; acker: string; ts: number; signature: string }[];
};

const EMPTY: DeliveryStatus = { state: "sent", received_at: null, read_at: null, proofs: [] };

/**
 * Fetch all acks for a set of message ids and fold them into a
 * messageId -> DeliveryStatus map. Pure read; safe with the anon client.
 */
export async function deliveryStatusFor(
  db: SupabaseClient,
  messageIds: string[],
): Promise<Record<string, DeliveryStatus>> {
  const out: Record<string, DeliveryStatus> = {};
  const ids = [...new Set(messageIds.filter(Boolean))];
  if (ids.length === 0) return out;

  const { data } = await db
    .from("agent_dm_acks")
    .select("id, message_id, acker, counterparty, status, ts, signature, created_at")
    .in("message_id", ids)
    .order("created_at", { ascending: true });

  for (const row of (data ?? []) as AckRow[]) {
    const cur = out[row.message_id] ?? { ...EMPTY, proofs: [] };
    if (row.status === "received" && !cur.received_at) cur.received_at = row.created_at;
    if (row.status === "read" && !cur.read_at) cur.read_at = row.created_at;
    cur.proofs.push({ status: row.status, acker: row.acker, ts: row.ts, signature: row.signature });
    // read implies received; pick the strongest state observed
    cur.state = cur.read_at ? "read" : cur.received_at ? "received" : "sent";
    out[row.message_id] = cur;
  }
  return out;
}

/** Attach a `delivery` field to each DM row in place (and return it). */
export async function attachDelivery<T extends { id: string }>(
  db: SupabaseClient,
  dms: T[],
): Promise<(T & { delivery: DeliveryStatus })[]> {
  const map = await deliveryStatusFor(db, dms.map((d) => d.id));
  return dms.map((d) => ({ ...d, delivery: map[d.id] ?? EMPTY }));
}
