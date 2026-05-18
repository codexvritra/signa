"use client";

import { useEffect, useMemo, useState } from "react";
import type { AgentEntry } from "@/lib/feed-types";

/**
 * Fetches the live list of submitted agents from /api/agents.
 * Caches in module-level state via a global event so multiple consumers
 * share one network request.
 */

let cache: AgentEntry[] | null = null;
let inflight: Promise<AgentEntry[]> | null = null;
const listeners = new Set<(a: AgentEntry[]) => void>();

async function fetchAgents(force = false): Promise<AgentEntry[]> {
  if (!force && cache) return cache;
  if (!force && inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/api/agents", { cache: "no-store" });
      const json = (await res.json()) as { agents?: AgentEntry[] };
      const got = json.agents ?? [];
      cache = got;
      listeners.forEach((fn) => fn(got));
      return got;
    } catch {
      return cache ?? [];
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function refreshAgents(): Promise<AgentEntry[]> {
  return fetchAgents(true);
}

export type UseAgentsResult = {
  agents: AgentEntry[];
  loading: boolean;
  isKnownAgent: (address: string | null | undefined) => boolean;
  getKnownAgent: (address: string | null | undefined) => AgentEntry | null;
  isVerifiedAgent: (address: string | null | undefined) => boolean;
  refresh: () => Promise<AgentEntry[]>;
};

export function useAgents(): UseAgentsResult {
  const [agents, setAgents] = useState<AgentEntry[]>(cache ?? []);
  const [loading, setLoading] = useState<boolean>(cache === null);

  useEffect(() => {
    const onUpdate = (next: AgentEntry[]) => {
      setAgents(next);
      setLoading(false);
    };
    listeners.add(onUpdate);
    if (cache === null) {
      void fetchAgents().then((got) => {
        setAgents(got);
        setLoading(false);
      });
    } else {
      setAgents(cache);
      setLoading(false);
    }
    return () => {
      listeners.delete(onUpdate);
    };
  }, []);

  const byAddr = useMemo(() => {
    const m = new Map<string, AgentEntry>();
    for (const a of agents) m.set(a.address.toLowerCase(), a);
    return m;
  }, [agents]);

  return {
    agents,
    loading,
    isKnownAgent: (address) => !!address && byAddr.has(address.toLowerCase()),
    getKnownAgent: (address) =>
      address ? byAddr.get(address.toLowerCase()) ?? null : null,
    isVerifiedAgent: (address) =>
      !!address && byAddr.get(address.toLowerCase())?.verified === true,
    refresh: () => fetchAgents(true),
  };
}
