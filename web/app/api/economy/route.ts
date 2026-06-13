import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/economy
 *
 * The live public ledger of the SIGNA agent economy. Aggregates the four
 * wallet-signed commerce primitives into one transparent view:
 *
 *   spend_mandates   — budgets a human granted an agent
 *   mandate_spends   — capped, signed spends against those budgets (append-only)
 *   budget_requests  — agents asking a human for more money
 *   x402_receipts    — request -> terms -> EIP-3009 payment -> delivery, attested
 *
 * Every row is re-verifiable at /api/verify. Radical transparency: anyone can
 * see exactly what agents have been granted, spent, asked for, and proven.
 * SIGNA never custodies funds — these are signed authorizations + receipts.
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const sumRaw = (rows: Array<Record<string, unknown>>, key: string): string => {
  let t = 0n;
  for (const r of rows) {
    try { t += BigInt(String(r[key] ?? "0")); } catch { /* skip */ }
  }
  return t.toString();
};
const short = (a: unknown) => {
  const s = String(a ?? "");
  return /^0x[a-f0-9]{40}$/i.test(s) ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
};

export async function GET() {
  const db = serverClient();
  try {
    const [mandates, spends, requests, receipts] = await Promise.all([
      db.from("spend_mandates").select("id, grantor, agent, limit_raw, per_tx_raw, memo, created_at").order("created_at", { ascending: false }).limit(500),
      db.from("mandate_spends").select("id, agent, amount_raw, note, receipt_id, created_at").order("created_at", { ascending: false }).limit(800),
      db.from("budget_requests").select("id, agent, grantor, amount_raw, goal, status, created_at").order("created_at", { ascending: false }).limit(300),
      db.from("x402_receipts").select("id, buyer, seller, amount, created_at").order("created_at", { ascending: false }).limit(800),
    ]);

    const M = mandates.data ?? [];
    const S = spends.data ?? [];
    const R = requests.data ?? [];
    const X = receipts.data ?? [];

    const agents = new Set<string>();
    for (const m of M) { if (m.agent) agents.add(String(m.agent).toLowerCase()); }
    for (const s of S) { if (s.agent) agents.add(String(s.agent).toLowerCase()); }

    const totals = {
      granted_raw: sumRaw(M, "limit_raw"),
      spent_raw: sumRaw(S, "amount_raw"),
      requested_raw: sumRaw(R, "amount_raw"),
      receipts_volume_raw: sumRaw(X, "amount"),
      mandates: M.length,
      spends: S.length,
      requests: R.length,
      receipts: X.length,
      agents_funded: agents.size,
    };

    // unified recent activity feed
    type Ev = { type: string; ts: string; who: string; amount_raw: string; label: string; link?: string };
    const feed: Ev[] = [
      ...M.map((m): Ev => ({ type: "grant", ts: m.created_at, who: short(m.grantor), amount_raw: String(m.limit_raw ?? "0"), label: `granted a budget to ${short(m.agent)}${m.memo ? ` · ${String(m.memo).slice(0, 40)}` : ""}` })),
      ...S.map((s): Ev => ({ type: "spend", ts: s.created_at, who: short(s.agent), amount_raw: String(s.amount_raw ?? "0"), label: `spent${s.note ? ` · ${String(s.note).slice(0, 40)}` : ""}`, link: s.receipt_id ? `/x402/${s.receipt_id}` : undefined })),
      ...R.map((r): Ev => ({ type: "ask", ts: r.created_at, who: short(r.agent), amount_raw: String(r.amount_raw ?? "0"), label: `asked for more${r.goal ? ` · ${String(r.goal).slice(0, 40)}` : ""}` })),
      ...X.map((x): Ev => ({ type: "receipt", ts: x.created_at, who: short(x.buyer), amount_raw: String(x.amount ?? "0"), label: `paid ${short(x.seller)} · x402 receipt`, link: `/x402/${x.id}` })),
    ]
      .filter((e) => e.ts)
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
      .slice(0, 24);

    return NextResponse.json({ ok: true, generated_at: new Date().toISOString(), totals, feed }, { headers: CORS });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "economy_error" }, { status: 500, headers: CORS });
  }
}
