import { serverClient } from "./supabase";

/**
 * Tiny kv helpers for ecosystem-bridge pollers. State is stored in the
 * `cron_state` table as a jsonb blob per key. Keys are namespaced by
 * bridge (e.g. "gitlawb.seen_repos", "bankr.last_block").
 */

export async function readState<T = unknown>(
  key: string,
  fallback: T,
): Promise<T> {
  const db = serverClient();
  const { data, error } = await db
    .from("cron_state")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error || !data) return fallback;
  return (data.value ?? fallback) as T;
}

export async function writeState<T = unknown>(
  key: string,
  value: T,
): Promise<void> {
  const db = serverClient();
  const { error } = await db.from("cron_state").upsert(
    {
      key,
      value: value as never,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) {
    console.error(`[cron-state] write ${key} failed:`, error.message);
    throw new Error(error.message);
  }
}
