/**
 * Root Edge (rootAI) integration — server-side MCP client.
 *
 * Root Edge (@Root_Edge, rootedge.ai / rootai.wtf) is an AI market-
 * intelligence + execution agent on Base ($ROOTAI, Bankr-launched). Its
 * public, keyless integration surface is a Streamable-HTTP MCP server at
 * https://mcp.rootedge.ai/mcp (49 tools: fear/greed, Base token
 * opportunities, Bankr launches, news, DEX, Hyperliquid perps, Pyth).
 *
 * This wraps that MCP so SIGNA can surface Root's live Base market
 * intelligence to any agent on the wire — no API key, no auth. It is the
 * same composition story as the rest of SIGNA: Root brings the
 * intelligence, SIGNA brings the wallet-signed messaging substrate.
 */

const ROOT_MCP = process.env.ROOT_MCP_URL ?? "https://mcp.rootedge.ai/mcp";
const MCP_HEADERS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
} as const;

/** Friendly alias -> real Root MCP tool name. Read-only intelligence tools only. */
export const ROOT_TOOLS: Record<string, string> = {
  feargreed: "edge_fear_greed",
  opportunities: "edge_discover_base_token_opportunities",
  launches: "edge_bankr_launches",
  news: "edge_news_latest",
  perps: "edge_perps_market",
  trending: "dex_trending_metas",
};

type Parsed = unknown;

function parseMcpBody(text: string, ct: string): any {
  // Streamable-HTTP MCP answers as SSE ("data: {...}") or plain JSON.
  if (ct.includes("text/event-stream")) {
    const dataLines = text.split(/\r?\n/).filter((l) => l.startsWith("data:"));
    for (let i = dataLines.length - 1; i >= 0; i--) {
      try { return JSON.parse(dataLines[i].slice(5).trim()); } catch { /* keep scanning */ }
    }
    return null;
  }
  try { return JSON.parse(text); } catch { return null; }
}

async function mcpFetch(
  body: Record<string, unknown>,
  sessionId: string | null,
  timeoutMs = 12_000,
): Promise<{ status: number; sid: string | null; json: any }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { ...MCP_HEADERS };
    if (sessionId) headers["mcp-session-id"] = sessionId;
    const r = await fetch(ROOT_MCP, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal,
      cache: "no-store",
    });
    const sid = r.headers.get("mcp-session-id");
    const text = await r.text();
    return { status: r.status, sid, json: parseMcpBody(text, r.headers.get("content-type") ?? "") };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Call one Root Edge MCP tool and return its parsed result. Performs the
 * full Streamable-HTTP handshake (initialize -> initialized -> tools/call)
 * each call — stateless and serverless-safe.
 */
export async function rootMcpCall(tool: string, args: Record<string, unknown> = {}): Promise<Parsed> {
  const init = await mcpFetch(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "signa", version: "1.0" } },
    },
    null,
  );
  if (init.status !== 200) throw new Error(`root mcp initialize ${init.status}`);
  const sid = init.sid;
  // best-effort initialized notification (some servers gate tools on it)
  await mcpFetch({ jsonrpc: "2.0", method: "notifications/initialized" }, sid).catch(() => {});

  const res = await mcpFetch({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: tool, arguments: args } }, sid);
  if (res.json?.error) throw new Error(res.json.error.message ?? "root mcp tool error");
  const content = res.json?.result?.content;
  if (!Array.isArray(content)) throw new Error("root mcp: no content");
  const blocks = content
    .filter((c: any) => c?.type === "text" && typeof c.text === "string")
    .map((c: any) => { try { return JSON.parse(c.text); } catch { return c.text; } });
  if (blocks.length === 0) return null;
  return blocks.length === 1 ? blocks[0] : blocks;
}

// ── tiny in-memory cache so SIGNA isn't hammering Root's MCP ──
const cache = new Map<string, { at: number; data: Parsed }>();
const TTL_MS = 30_000;

/** Resolve a friendly alias (or raw edge_/dex_ tool) to live Root data, cached ~30s. */
export async function rootIntel(alias: string): Promise<Parsed> {
  const tool = ROOT_TOOLS[alias] ?? (/^(edge|dex|hyperliquid|binance)_/.test(alias) ? alias : null);
  if (!tool) throw new Error(`unknown root tool: ${alias}`);
  const hit = cache.get(tool);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  const data = await rootMcpCall(tool);
  cache.set(tool, { at: Date.now(), data });
  return data;
}

/** A compact, human-readable one-liner of the current Base market read — for agent replies. */
export async function rootMarketSummary(): Promise<string> {
  const [fg, opps] = await Promise.all([
    rootIntel("feargreed").catch(() => null),
    rootIntel("opportunities").catch(() => null),
  ]);
  const fgPart = (fg as any)?.label
    ? `Base/crypto sentiment: ${(fg as any).label} (${Math.round(Number((fg as any).score))}/100).`
    : "";
  const top = (opps as any)?.results?.[0];
  const oppPart = top?.launch
    ? ` Top Base opportunity: ${top.launch.tokenName} ($${top.launch.tokenSymbol}) ${String(top.launch.tokenAddress ?? "").slice(0, 10)}… score ${top.score}.`
    : "";
  const s = (fgPart + oppPart).trim();
  return s || "Root Edge intelligence is momentarily unavailable.";
}
