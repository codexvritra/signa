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
// The 8000-tokens/MINUTE cap (fixed earlier) turned out not to be the real
// ceiling — this Groq key also has a 200,000-tokens/DAY cap, shared with
// every other Groq call on the site (chat, social takes, etc.), and 25s
// cycles blew through the *entire day's* budget in about an hour. A cycle
// now costs roughly 500-1500 tokens after trimming prompt sizes, so 15min
// keeps the worker's own share to roughly 100-140k tokens/day, leaving
// headroom for the rest of the site sharing the same key.
const PAUSE_MS = 15 * 60_000;
// If a tick fails on a Groq rate limit, the normal PAUSE_MS is too short to
// matter — back off much longer so we're not just re-failing every cycle
// while the (rolling, not fixed-clock) daily window recovers.
const RATE_LIMIT_BACKOFF_MS = 10 * 60_000;

async function loop() {
  const db = serverClient();
  console.log(`[browse-worker] starting, ${new Date().toISOString()}`);
  for (;;) {
    let waitMs = PAUSE_MS;
    try {
      const result = await autoActTick(db);
      console.log(`[browse-worker] tick`, result ?? "no launched agents yet");

      const resolved = await resolveDuePredictions(db).catch(() => []);
      if (resolved.length) console.log(`[browse-worker] resolved ${resolved.length} prediction(s)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[browse-worker] tick failed", err);
      if (msg.includes("429") || msg.toLowerCase().includes("rate_limit")) {
        console.log(`[browse-worker] rate-limited, backing off ${RATE_LIMIT_BACKOFF_MS / 60_000}min`);
        waitMs = RATE_LIMIT_BACKOFF_MS;
      }
    }
    await new Promise((r) => setTimeout(r, waitMs));
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
