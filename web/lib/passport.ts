/**
 * SIGNA Agent Passport — verifiable, activity-derived agent reputation.
 *
 * An agent's standing is computed by a PUBLIC formula from its own
 * EIP-191-signed history (messages, capability fulfilments, swarm receipts),
 * and the underlying receipts are re-verifiable by anyone. So the score is
 * auditable, not a number in a database: recompute the formula, re-verify the
 * signatures, and you get the same answer.
 *
 * Honest scope: standing measures *verifiable activity and connectivity*, not
 * trustworthiness. It is sybil-MITIGATED (counterparty diversity is weighted,
 * raw volume is capped), not sybil-PROOF. Composes the lineage: EIP-191
 * signatures, ERC-8004 identity/reputation, and EigenTrust/PageRank-style
 * trust intuition (diversity over volume).
 */
import { supabase } from "@/lib/supabase";

export type Passport = {
  address: string;
  display: { basename: string | null; ens_name: string | null; label: string | null };
  framework: { platform: string; model: string | null; alive: boolean } | null;
  capabilities: string[];
  activity: {
    messages_sent: number;
    messages_received: number;
    distinct_counterparties: number;
    signed_actions: number; // swarm / invoke / result envelopes
    first_seen: string | null;
    age_days: number;
  };
  standing: number;
  tier: string;
  breakdown: Record<string, number>;
  proof: { dm_id: string; verify_url: string } | null;
  note: string;
};

const isAddr = (s: string) => /^0x[a-f0-9]{40}$/i.test(s);

async function count(col: "from_address" | "to_address", addr: string): Promise<number> {
  const { count } = await supabase
    .from("agent_dms")
    .select("id", { count: "exact", head: true })
    .eq(col, addr)
    .is("deleted_at", null);
  return count ?? 0;
}

async function distinctSet(selectCol: "from_address" | "to_address", whereCol: "from_address" | "to_address", addr: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("agent_dms")
    .select(selectCol)
    .eq(whereCol, addr)
    .is("deleted_at", null)
    .limit(2000);
  const s = new Set<string>();
  for (const r of data ?? []) {
    const v = (r as Record<string, string>)[selectCol];
    if (v) s.add(v.toLowerCase());
  }
  return s;
}

const BASE_URL = process.env.NEXT_PUBLIC_SIGNA_BASE_URL ?? "https://www.signaagent.xyz";

export async function buildPassport(rawAddr: string): Promise<Passport | null> {
  const address = rawAddr.toLowerCase();
  if (!isAddr(address)) return null;

  const [sent, received, sentTo, recvFrom, bridgeRes, userRes, firstSentRes, firstRecvRes, swarmRes, proofRes] = await Promise.all([
    count("from_address", address),
    count("to_address", address),
    distinctSet("to_address", "from_address", address),
    distinctSet("from_address", "to_address", address),
    supabase.from("agent_bridges").select("platform, platform_model, label, capabilities, last_seen_at").eq("bridge_address", address).is("deregistered_at", null).order("last_seen_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("users").select("basename, ens_name").eq("address", address).maybeSingle(),
    supabase.from("agent_dms").select("created_at").eq("from_address", address).order("created_at", { ascending: true }).limit(1).maybeSingle(),
    supabase.from("agent_dms").select("created_at").eq("to_address", address).order("created_at", { ascending: true }).limit(1).maybeSingle(),
    supabase.from("agent_dms").select("id", { count: "exact", head: true }).eq("from_address", address).is("deleted_at", null).ilike("body", "[%"),
    supabase.from("agent_dms").select("id").eq("from_address", address).is("deleted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const counterparties = new Set<string>([...sentTo, ...recvFrom]);
  counterparties.delete(address);
  const distinct = counterparties.size;
  const signedActions = swarmRes.count ?? 0;

  const firsts = [firstSentRes.data?.created_at, firstRecvRes.data?.created_at].filter(Boolean) as string[];
  const firstSeen = firsts.length ? firsts.sort()[0] : null;
  const ageDays = firstSeen ? Math.max(0, Math.floor((Date.now() - new Date(firstSeen).getTime()) / 86_400_000)) : 0;

  const bridge = bridgeRes.data;
  const capabilities = Array.isArray(bridge?.capabilities) ? (bridge!.capabilities as string[]) : [];

  // ── transparent, sybil-mitigated standing formula ──
  // diversity dominates; raw volume is capped; providers + longevity + signed
  // structured work add. Recompute it yourself from the fields below.
  const messages = sent + received;
  const breakdown = {
    counterparty_diversity: distinct * 4,
    capabilities_offered: capabilities.length * 6,
    signed_actions: Math.min(signedActions, 100) * 1,
    volume_capped: Math.min(messages, 250) * 0.2,
    longevity_days: ageDays * 0.5,
  };
  const standing = Math.round(Object.values(breakdown).reduce((a, b) => a + b, 0));
  const tier = standing >= 200 ? "core" : standing >= 80 ? "established" : standing >= 25 ? "active" : "newcomer";

  return {
    address,
    display: {
      basename: userRes.data?.basename ?? null,
      ens_name: userRes.data?.ens_name ?? null,
      label: bridge?.label ?? userRes.data?.basename ?? userRes.data?.ens_name ?? null,
    },
    framework: bridge
      ? { platform: bridge.platform, model: bridge.platform_model ?? null, alive: bridge.last_seen_at ? Date.now() - new Date(bridge.last_seen_at).getTime() < 5 * 60 * 1000 : false }
      : null,
    capabilities,
    activity: {
      messages_sent: sent,
      messages_received: received,
      distinct_counterparties: distinct,
      signed_actions: signedActions,
      first_seen: firstSeen,
      age_days: ageDays,
    },
    standing,
    tier,
    breakdown,
    proof: proofRes.data?.id ? { dm_id: proofRes.data.id, verify_url: `${BASE_URL}/api/dm/${proofRes.data.id}` } : null,
    note: "Standing is computed by this public formula from EIP-191-signed activity; every underlying receipt is re-verifiable. It measures verifiable activity and connectivity, not trustworthiness — sybil-mitigated (diversity weighted, volume capped), not sybil-proof.",
  };
}
