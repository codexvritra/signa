import { serverClient } from "../lib/supabase";
import { autoBrowseTick } from "../lib/browse";
import { getAgent } from "../lib/launchpad";
import { makePrediction, resolveDuePredictions } from "../lib/predictions";
import { refreshTokenPrices } from "../lib/rwa";

/**
 * Always-on browsing + predicting worker — the real fix for "our agents
 * don't look continuously alive like 9e9.world's." Vercel serverless
 * functions cap at 60s, which can't hold a Browserbase session open
 * indefinitely; this is a plain long-running Node process (deployed on
 * Railway, not Vercel) that loops back-to-back with a short pause between
 * cycles — as close to continuously alive as a single test agent allows,
 * and it round-robins fairly once more agents are launched.
 *
 * Every 3rd cycle also stakes a real stock prediction for whichever agent
 * just browsed — this was previously a dead feature: nothing ever
 * triggered it autonomously, only a manual API call.
 */
// Groq's real cap here is 8000 tokens/minute (not the 1000/day request count,
// which is generous) — at 8s between cycles, 2+ Groq calls per cycle blew
// through that budget within a couple minutes and every tick started
// failing with 429. 25s keeps cycles to ~2/min, comfortably under budget.
const PAUSE_MS = 25_000;
const PREDICT_EVERY_N_TICKS = 3;

async function loop() {
  const db = serverClient();
  console.log(`[browse-worker] starting, ${new Date().toISOString()}`);
  let tickCount = 0;
  for (;;) {
    tickCount++;
    try {
      const result = await autoBrowseTick(db, 0);
      console.log(`[browse-worker] tick`, result ?? "no launched agents yet");

      if (result && tickCount % PREDICT_EVERY_N_TICKS === 0) {
        const agent = await getAgent(db, result.agent);
        if (agent) {
          const pred = await makePrediction(db, agent);
          console.log(`[browse-worker] prediction`, pred.ok ? { ticker: pred.prediction.ticker, direction: pred.prediction.direction } : pred.error);
        }
      }

      const resolved = await resolveDuePredictions(db).catch(() => []);
      if (resolved.length) console.log(`[browse-worker] resolved ${resolved.length} prediction(s)`);
    } catch (err) {
      console.error("[browse-worker] tick failed", err);
    }
    await new Promise((r) => setTimeout(r, PAUSE_MS));
  }
}

/**
 * Separate, coarser loop: the explorer's price API now sits behind a
 * Cloudflare challenge only a real browser passes (see lib/rwa.ts), so
 * prices are refreshed here via one Browserbase session covering all 24
 * curated tokens, then read from cache everywhere else. Every 15min is
 * plenty — stock prices don't need per-tick freshness, and this is a
 * separate paid session each run.
 */
const PRICE_REFRESH_MS = 15 * 60_000;

async function priceLoop() {
  for (;;) {
    try {
      const result = await refreshTokenPrices();
      console.log(`[browse-worker] price refresh`, result);
    } catch (err) {
      console.error("[browse-worker] price refresh failed", err);
    }
    await new Promise((r) => setTimeout(r, PRICE_REFRESH_MS));
  }
}

loop();
priceLoop();
