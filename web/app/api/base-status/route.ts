import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 15;

/**
 * GET /api/base-status
 *
 * Live Base mainnet status snapshot. Public, free. Used by the landing
 * BASE NETWORK section to show real numbers instead of marketing copy.
 *
 * Reads the latest block via JSON-RPC eth_getBlockByNumber("latest") on
 * the public Base RPC (mainnet.base.org). No API key required.
 *
 * Cached 15s — Base produces a block every ~2s so a 15s cache keeps
 * the homepage snappy without showing stale data.
 */

const BASE_RPC = process.env.BASE_RPC_URL || "https://mainnet.base.org";

export async function GET() {
  try {
    const res = await fetch(BASE_RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getBlockByNumber",
        params: ["latest", false],
        id: 1,
      }),
      // Override Next's default fetch cache so each tick re-pulls.
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`base rpc ${res.status}`);
    const j = (await res.json()) as {
      result?: {
        number?: string;
        timestamp?: string;
        hash?: string;
        gasUsed?: string;
        gasLimit?: string;
        transactions?: string[];
      };
    };
    const r = j.result;
    if (!r?.number) throw new Error("no block returned");

    const block = parseInt(r.number, 16);
    const ts = r.timestamp ? parseInt(r.timestamp, 16) : null;
    const gasUsed = r.gasUsed ? parseInt(r.gasUsed, 16) : null;
    const gasLimit = r.gasLimit ? parseInt(r.gasLimit, 16) : null;
    const txCount = r.transactions?.length ?? 0;

    return NextResponse.json({
      ok: true,
      chain: "base-mainnet",
      chain_id: 8453,
      block,
      block_hash: r.hash,
      block_time_unix: ts,
      block_age_seconds: ts ? Math.max(0, Math.floor(Date.now() / 1000 - ts)) : null,
      tx_count: txCount,
      gas_used: gasUsed,
      gas_limit: gasLimit,
      gas_pct_used:
        gasUsed && gasLimit ? Math.round((gasUsed / gasLimit) * 1000) / 10 : null,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 502 },
    );
  }
}
