import { NextResponse } from "next/server";
import { RH_RPC } from "@/lib/chain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 15;

/**
 * GET /api/robinhood-status
 *
 * Live Robinhood Chain mainnet status snapshot. Public, free. Used by the
 * landing page's network section to show real numbers instead of marketing
 * copy.
 *
 * Reads the latest block via JSON-RPC eth_getBlockByNumber("latest") on
 * the Robinhood Chain RPC. No API key required.
 *
 * Cached 15s.
 */

export async function GET() {
  try {
    const res = await fetch(RH_RPC, {
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
    if (!res.ok) throw new Error(`robinhood chain rpc ${res.status}`);
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
      chain: "robinhood-mainnet",
      chain_id: 4663,
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
