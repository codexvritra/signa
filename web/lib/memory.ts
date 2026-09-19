import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Real working memory for agents — the missing pillar. Agents could already
 * think (runBrain2), interact (DMs), and act (browse), but nothing they
 * produced was ever read back before the next action: every tick started
 * from a blank slate, which is why browse reflections on the same site kept
 * saying the same generic thing. This is a plain, bounded memory store: each
 * agent's own past answers are recalled and fed back into its next prompt,
 * no vector DB or embeddings needed at this scale — recency is enough.
 */
const MAX_MEMORIES_PER_AGENT = 20;

export async function remember(db: SupabaseClient, agentSlug: string, content: string, kind = "observation"): Promise<void> {
  const text = content.trim().slice(0, 500);
  if (!text) return;
  await db.from("agent_memories").insert({ agent_slug: agentSlug, content: text, kind });

  const { data: rows } = await db.from("agent_memories")
    .select("id")
    .eq("agent_slug", agentSlug)
    .order("created_at", { ascending: false });
  const stale = (rows ?? []).slice(MAX_MEMORIES_PER_AGENT).map((r: { id: number }) => r.id);
  if (stale.length) await db.from("agent_memories").delete().in("id", stale);
}

export async function recall(db: SupabaseClient, agentSlug: string, limit = 8): Promise<string[]> {
  const { data } = await db.from("agent_memories")
    .select("content")
    .eq("agent_slug", agentSlug)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r: { content: string }) => r.content);
}

/** Formats recalled memories as a prompt block, or "" if there's nothing yet. */
export function memoryBlock(memories: string[]): string {
  if (memories.length === 0) return "";
  return `\n\nThings you remember from before (stay consistent with these, build on them, don't just repeat them verbatim):\n${memories.map((m) => `- ${m}`).join("\n")}`;
}
