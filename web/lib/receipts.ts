/**
 * Partner receipts aggregator (v0.52).
 *
 * Computes wallet-signed activity per partner network from the
 * signa_rooms + signa_room_messages tables. Classification mirrors
 * lib/room-badges.ts (which is the public-facing source of truth for
 * "what partner does this room belong to"):
 *
 *   bankr     — gate_token_address set         (Bankr-launched holder rooms)
 *   gitlawb   — slug starts with "b-"          (bounty threads)
 *   miroshark — slug starts with "sim-"        (sim verdict threads)
 *   aeon      — derived later via on-chain     (no rooms yet, kept for shape)
 *   community — everything else                (user-created rooms)
 *
 * Read-only. Cache for 60s in-memory so the public ledger doesn't
 * hammer Postgres.
 */
import { supabase } from "./supabase";

export type PartnerKey =
  | "bankr"
  | "gitlawb"
  | "miroshark"
  | "aeon"
  | "community";

export const PARTNER_LABEL: Record<PartnerKey, string> = {
  bankr: "Bankr",
  gitlawb: "Gitlawb",
  miroshark: "MiroShark",
  aeon: "Aeon",
  community: "Community",
};

export const PARTNER_DESCRIPTION: Record<PartnerKey, string> = {
  bankr:
    "Holder rooms auto-created for every Bankr-launched token on Base. Hold-to-chat enforced via viem balanceOf at the message layer.",
  gitlawb:
    "Bounty threads keyed to gitlawb open tasks. Maintainers and claimants coordinate signed end-to-end.",
  miroshark:
    "Verdict threads opened by the MiroShark webhook the moment a swarm sim finishes. Reads stay open, replies are wallet-signed.",
  aeon:
    "DM threads to ERC-8004 agents registered on the Aeon Identity Registry. Each entry is on-chain on Ethereum mainnet.",
  community:
    "Rooms created by community wallets — open for any topic, every message signed locally with the poster's wallet.",
};

export type PartnerReceipt = {
  partner: PartnerKey;
  label: string;
  description: string;
  rooms: number;
  rooms_7d: number;
  messages: number;
  messages_7d: number;
  unique_posters: number;
  last_activity: string | null;
};

type CacheEntry = { ts: number; data: PartnerReceipt[] };
let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 60 * 1000;

export async function getPartnerReceipts(): Promise<PartnerReceipt[]> {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    return cache.data;
  }

  // One query pulls minimal metadata. We classify in JS to keep the
  // SQL portable + identical to lib/room-badges.ts classification.
  const { data: rooms } = await supabase
    .from("signa_rooms")
    .select("id, slug, gate_token_address, created_at, ts")
    .order("created_at", { ascending: false })
    .limit(2000);

  const roomMap = new Map<
    string,
    { partner: PartnerKey; created_at: string }
  >();
  for (const r of rooms ?? []) {
    const partner = classify(r);
    roomMap.set(r.id, { partner, created_at: r.created_at });
  }

  // Messages — pull recent up to 5000 and aggregate per room.
  const { data: messages } = await supabase
    .from("signa_room_messages")
    .select("id, room_id, from_address, ts, created_at")
    .order("ts", { ascending: false })
    .limit(5000);

  const now = Date.now();
  const cutoff7d = now - 7 * 24 * 60 * 60 * 1000;

  const agg: Record<
    PartnerKey,
    {
      rooms: Set<string>;
      rooms_7d: Set<string>;
      messages: number;
      messages_7d: number;
      posters: Set<string>;
      last_activity_ms: number;
    }
  > = {
    bankr: blank(),
    gitlawb: blank(),
    miroshark: blank(),
    aeon: blank(),
    community: blank(),
  };

  for (const r of rooms ?? []) {
    const partner = classify(r);
    agg[partner].rooms.add(r.id);
    if (Date.parse(r.created_at) >= cutoff7d) {
      agg[partner].rooms_7d.add(r.id);
    }
  }

  for (const m of messages ?? []) {
    const info = roomMap.get(m.room_id);
    if (!info) continue;
    const tsMs = typeof m.ts === "number" ? m.ts : Number(m.ts);
    const partner = info.partner;
    agg[partner].messages += 1;
    if (Number.isFinite(tsMs) && tsMs >= cutoff7d) agg[partner].messages_7d += 1;
    agg[partner].posters.add(String(m.from_address).toLowerCase());
    if (Number.isFinite(tsMs) && tsMs > agg[partner].last_activity_ms) {
      agg[partner].last_activity_ms = tsMs;
    }
  }

  const result: PartnerReceipt[] = (Object.keys(agg) as PartnerKey[]).map(
    (key) => {
      const a = agg[key];
      return {
        partner: key,
        label: PARTNER_LABEL[key],
        description: PARTNER_DESCRIPTION[key],
        rooms: a.rooms.size,
        rooms_7d: a.rooms_7d.size,
        messages: a.messages,
        messages_7d: a.messages_7d,
        unique_posters: a.posters.size,
        last_activity:
          a.last_activity_ms > 0
            ? new Date(a.last_activity_ms).toISOString()
            : null,
      };
    },
  );

  cache = { ts: Date.now(), data: result };
  return result;
}

function blank() {
  return {
    rooms: new Set<string>(),
    rooms_7d: new Set<string>(),
    messages: 0,
    messages_7d: 0,
    posters: new Set<string>(),
    last_activity_ms: 0,
  };
}

function classify(r: {
  slug: string;
  gate_token_address?: string | null;
}): PartnerKey {
  if (r.gate_token_address) return "bankr";
  const slug = (r.slug ?? "").toLowerCase();
  if (slug.startsWith("b-")) return "gitlawb";
  if (slug.startsWith("sim-")) return "miroshark";
  return "community";
}

export function clearReceiptsCache() {
  cache = null;
}
