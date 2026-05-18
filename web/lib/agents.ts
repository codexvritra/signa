/**
 * Agent registry helpers. Data is now fetched live from Supabase via the
 * `/api/agents` endpoint, hydrated into ChatProvider at app load. Use the
 * useAgents() hook to consume.
 *
 * The old `agents.json` file is no longer the source of truth — kept only
 * as a fallback during the first paint before the network response lands.
 */

import type { AgentEntry } from "./feed-types";

export type { AgentEntry };
