import type { SupabaseClient } from "@supabase/supabase-js";
import { browserbase } from "@browserbasehq/stagehand";
import { STOCK_TOKENS, findStock, fetchMarket, type StockToken } from "./rwa";
import { agentAccount, type LaunchAgent } from "./launchpad";

/**
 * Verifiable, scored stock predictions — the "put your money where your
 * mouth is" layer. An agent researches a real Robinhood Chain Stock Token
 * (the same canonical registry /rwa vouches for), stakes a signed,
 * falsifiable directional call, and it gets resolved against the real
 * onchain-explorer price once the horizon passes. Unlike a narrated
 * diary entry, this has an accountable outcome: right or wrong, signed
 * both times.
 */
const HORIZON_MS = 30 * 60_000; // 30 min — short enough to actually resolve and show results

function predictPreimage(a: { agent: string; ticker: string; direction: string; price: number; ts: number; resolvesAt: number }) {
  return ["SIGDA stock prediction v1", `ts:${a.ts}`, `agent:${a.agent.toLowerCase()}`, `ticker:${a.ticker}`, `direction:${a.direction}`, `price:${a.price}`, `resolves_at:${a.resolvesAt}`].join("\n");
}
function resolvePreimage(a: { id: string; finalPrice: number; correct: boolean; ts: number }) {
  return ["SIGDA stock prediction resolution v1", `ts:${a.ts}`, `prediction:${a.id}`, `final_price:${a.finalPrice}`, `correct:${a.correct}`].join("\n");
}

async function researchDirection(stock: StockToken, priceUsd: number): Promise<{ direction: "up" | "down"; reasoning: string[] }> {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  let newsSnippet = "";
  if (apiKey) {
    try {
      const r = await browserbase.fetch({ apiKey, url: `https://finance.yahoo.com/quote/${stock.ticker}/`, format: "markdown" });
      newsSnippet = (typeof r.content === "string" ? r.content : JSON.stringify(r.content)).slice(0, 3000);
    } catch { /* fall through with no news context */ }
  }
  if (!groqKey) return { direction: "up", reasoning: ["(no GROQ_API_KEY — undirected default)"] };
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${groqKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: `You are a stock-research agent. Respond ONLY with JSON: {"reasoning": string[], "direction": "up"|"down"}. "reasoning" is 2-3 short lines citing something concrete from the page or the price given. This is a real, public, scored prediction — commit to one direction.` },
        { role: "user", content: `Ticker: ${stock.ticker} (${stock.company}). Current price: $${priceUsd}.\n\nReal page content:\n${newsSnippet || "(no page fetched — reason from price alone)"}` },
      ],
      temperature: 0.6,
      max_tokens: 300,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`groq predict failed (${res.status})`);
  const j = (await res.json()) as any;
  try {
    const parsed = JSON.parse((j?.choices?.[0]?.message?.content ?? "").trim());
    const direction: "up" | "down" = parsed.direction === "down" ? "down" : "up";
    const reasoning = Array.isArray(parsed.reasoning) ? parsed.reasoning.map(String).slice(0, 4) : [];
    return { direction, reasoning };
  } catch {
    return { direction: "up", reasoning: ["(model returned unparseable output)"] };
  }
}

/** Agent researches a real stock token and stakes a signed, falsifiable directional call. */
export async function makePrediction(db: SupabaseClient, agent: LaunchAgent, tickerOrNull?: string) {
  const stock = (tickerOrNull && findStock(tickerOrNull)) || STOCK_TOKENS[Math.floor(Math.random() * STOCK_TOKENS.length)];
  const market = await fetchMarket(stock.address);
  if (market.price_usd == null) return { ok: false as const, error: `no live price for ${stock.ticker}` };

  const { direction, reasoning } = await researchDirection(stock, market.price_usd);
  const ts = Date.now();
  const resolvesAt = ts + HORIZON_MS;
  const account = agentAccount(agent.slug);
  const signedMessage = predictPreimage({ agent: agent.address, ticker: stock.ticker, direction, price: market.price_usd, ts, resolvesAt });
  const signature = await account.signMessage({ message: signedMessage });

  const { data, error } = await db.from("stock_predictions").insert({
    agent_slug: agent.slug, agent_address: agent.address, ticker: stock.ticker, stock_address: stock.address,
    direction, price_at: market.price_usd, reasoning, made_at: new Date(ts).toISOString(), resolves_at: new Date(resolvesAt).toISOString(),
    resolved: false, signature, signed_message: signedMessage,
  }).select("*").single();
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, prediction: data };
}

/** Resolve any predictions past their horizon against the real current price. Bounded, safe to call often. */
export async function resolveDuePredictions(db: SupabaseClient, limit = 5) {
  const { data: due } = await db.from("stock_predictions").select("*").eq("resolved", false).lte("resolves_at", new Date().toISOString()).limit(limit);
  const resolved: unknown[] = [];
  for (const p of due ?? []) {
    const market = await fetchMarket(p.stock_address).catch(() => ({ price_usd: null }));
    if (market.price_usd == null) continue;
    const correct = p.direction === "up" ? market.price_usd >= p.price_at : market.price_usd <= p.price_at;
    const ts = Date.now();
    const account = agentAccount(p.agent_slug);
    const signedMessage = resolvePreimage({ id: p.id, finalPrice: market.price_usd, correct, ts });
    const resolution_signature = await account.signMessage({ message: signedMessage }).catch(() => null);
    const { data } = await db.from("stock_predictions")
      .update({ resolved: true, final_price: market.price_usd, correct, resolved_at: new Date(ts).toISOString(), resolution_signature, resolution_signed_message: signedMessage })
      .eq("id", p.id).select("*").single();
    if (data) resolved.push(data);
  }
  return resolved;
}
