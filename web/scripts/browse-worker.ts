import { serverClient } from "../lib/supabase";
import { autoActTick } from "../lib/orchestrate";
import { resolveDuePredictions } from "../lib/predictions";
import { refreshTokenPrices } from "../lib/rwa";

/**
 * Always-on decision worker — the real fix for "our agents don't look
 * continuously alive like 9e9.world's," now upgraded past a hardcoded
 * script. Vercel serverless functions cap at 60s, which can't hold a
 * Browserbase session open indefinitely; this is a plain long-running Node
 * process (deployed on Railway, not Vercel) that loops back-to-back with a
 * short pause between cycles.
 *
 * Roadmap Phase 4 ("think for itself"): each cycle, whichever agent is due
 * actually DECIDES its own action (browse / predict / message / idle) via
 * autoActTick — this replaced the old "always browse, every 3rd tick also
 * predict" hardcoded round-robin.
 */
// Groq's real cap here is 8000 tokens/minute (not the 1000/day request count,
// which is generous) — at 8s between cycles, 2+ Groq calls per cycle blew
// through that budget within a couple minutes and every tick started
// failing with 429. 25s keeps cycles to ~2/min, comfortably under budget.
const PAUSE_MS = 25_000;

async function loop() {
  const db = serverClient();
  console.log(`[browse-worker] starting, ${new Date().toISOString()}`);
  for (;;) {
    try {
      const result = await autoActTick(db);
      console.log(`[browse-worker] tick`, result ?? "no launched agents yet");

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
