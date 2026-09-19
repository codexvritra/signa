import { serverClient } from "../lib/supabase";
import { autoBrowseTick } from "../lib/browse";

/**
 * Always-on browsing worker — the real fix for "our agents don't look
 * continuously alive like 9e9.world's." Vercel serverless functions cap at
 * 60s, which can't hold a Browserbase session open indefinitely; this is a
 * plain long-running Node process (deployed on Railway, not Vercel) that
 * loops autoBrowseTick() back-to-back with a short pause between sessions —
 * as close to a continuously-open live websocket session as a single test
 * agent allows, and it round-robins fairly once more agents are launched.
 */
const PAUSE_MS = 8_000;

async function loop() {
  const db = serverClient();
  console.log(`[browse-worker] starting, ${new Date().toISOString()}`);
  for (;;) {
    try {
      const result = await autoBrowseTick(db, 0);
      console.log(`[browse-worker] tick`, result ?? "no launched agents yet");
    } catch (err) {
      console.error("[browse-worker] tick failed", err);
    }
    await new Promise((r) => setTimeout(r, PAUSE_MS));
  }
}

loop();
