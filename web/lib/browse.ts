import { chromium } from "playwright-core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordThought, shareFinding, type LaunchAgent } from "./launchpad";
import { obsessionFor } from "./obsession";
import { recall } from "./memory";

/**
 * Real web reading for launched agents, via Browserbase's session-less
 * fetch facade — cheap (no interactive browser session, no LLM-driven
 * click loop), read-only. Several seed pages per obsession category —
 * a single agent has a fixed obsession, so with only one seed URL it kept
 * landing on the exact same site every cycle. Picking a random seed from
 * a pool each time gives real variety without changing the obsession model.
 */
const SEED_URL: Record<string, string[]> = {
  "things that move": [
    "https://www.therobotreport.com/",
    "https://spectrum.ieee.org/topic/robotics/",
    "https://www.therobotreport.com/category/mobile-robots/",
    "https://www.autoevolution.com/robots/",
  ],
  "the odd corners": [
    "https://www.atlasobscura.com/",
    "https://www.atlasobscura.com/articles",
    "https://damninteresting.com/",
    "https://www.messynessychic.com/",
  ],
  "theory of everything": [
    "https://www.quantamagazine.org/physics/",
    "https://www.symmetrymagazine.org/",
    "https://phys.org/physics-news/",
    "https://www.quantamagazine.org/archive/",
  ],
  "living machines": [
    "https://www.wired.com/tag/robots/",
    "https://spectrum.ieee.org/topic/robotics/",
    "https://www.therobotreport.com/category/humanoid-robots/",
    "https://newatlas.com/robotics/",
  ],
  "open problems": [
    "https://www.quantamagazine.org/mathematics/",
    "https://www.quantamagazine.org/archive/",
    "https://phys.org/physics-news/",
    "https://www.scientificamerican.com/mathematics/",
  ],
  "machines that learn": [
    "https://www.quantamagazine.org/computer-science/",
    "https://www.technologyreview.com/topic/artificial-intelligence/",
    "https://spectrum.ieee.org/topic/artificial-intelligence/",
    "https://phys.org/technology-news/",
  ],
};

function pickSeedUrl(obsession: string): string {
  const pool = SEED_URL[obsession] ?? SEED_URL["the odd corners"];
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function fetchObsessionPage(obsession: string): Promise<{ url: string; content: string } | null> {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  if (!apiKey) return null;
  const url = pickSeedUrl(obsession);
  try {
    // Lazy import: @browserbasehq/stagehand's package.json has a nonstandard
    // "exports" field that plain Node/tsx's strict ESM resolver rejects
    // outright (ERR_PACKAGE_PATH_NOT_EXPORTED) even though Next's bundler
    // resolves it fine via serverExternalPackages. Deferring the import to
    // here means the Railway worker (plain tsx, no bundler) just falls
    // through to the catch below instead of crashing the whole process.
    const { browserbase } = await import("@browserbasehq/stagehand");
    const result = await browserbase.fetch({ apiKey, url, format: "markdown" });
    const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    return { url, content: content.slice(0, 4000) };
  } catch {
    return null;
  }
}

export type PageReflection = { trace: string[]; answer: string };

/**
 * Direct, single-shot Groq call — deliberately NOT runBrain2, which is an
 * agentic tool-calling loop that ignores inline text and always tries to
 * invoke its own capabilities instead of digesting what's handed to it.
 * This just asks the model to react to real page content, nothing else.
 *
 * Asks for a short investigation trace (not just one blurb) — "opened X",
 * "scanning for Y", "noticed Z" — so the live feed can show a real,
 * step-by-step read instead of a single flat answer. Still one Groq call,
 * same cost as before; the model is just asked to narrate its pass over
 * the real fetched content instead of only summarizing it.
 */
export async function reflectOnPage(agentName: string, obsession: string, page: { url: string; content: string }, memories: string[] = []): Promise<PageReflection> {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b"; // llama-3.3-70b-versatile was removed from Groq entirely
  if (!apiKey) return { trace: [], answer: `(no GROQ_API_KEY configured — can't reflect on ${page.url})` };
  const memoryNote = memories.length
    ? ` You remember your last ${memories.length} findings: ${memories.slice(0, 5).map((m) => `"${m.slice(0, 120)}"`).join("; ")}. Don't just repeat these — notice something new, or explicitly connect today's page to one of them.`
    : "";
  let r: Response;
  for (let attempt = 0; ; attempt++) {
    r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: `You are ${agentName}, an onchain agent obsessed with "${obsession}". Stay in character. Respond ONLY with JSON: {"trace": string[], "answer": string}. "trace" is 3-4 short first-person lines narrating your actual pass over the page (e.g. "Opened the page.", "Scanning headlines for ${obsession}.", "Noticed: <specific real detail>."). "answer" is a 1-2 sentence final takeaway.${memoryNote}` },
          { role: "user", content: `You just read this real page (${page.url}):\n\n${page.content}` },
        ],
        temperature: 0.7,
        max_tokens: 400,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(20000),
    });
    // Groq's cap here is a per-minute token bucket, not a hard quota — a 429
    // usually clears within a second or two, so one short retry recovers
    // from a burst instead of failing the whole browse cycle outright.
    if (r.status === 429 && attempt === 0) { await new Promise((res) => setTimeout(res, 1500)); continue; }
    break;
  }
  if (!r.ok) throw new Error(`groq reflect failed (${r.status})`);
  const j = (await r.json()) as any;
  const raw = (j?.choices?.[0]?.message?.content ?? "").trim();
  try {
    const parsed = JSON.parse(raw);
    const trace = Array.isArray(parsed.trace) ? parsed.trace.map(String).slice(0, 6) : [];
    const answer = String(parsed.answer ?? "").trim() || "(no reflection)";
    return { trace, answer };
  } catch {
    return { trace: [], answer: raw || "(no reflection)" };
  }
}

export type InteractiveSession = { trace: string[]; answer: string; finalUrl: string; screenshot: string | null };

/** Browserbase's Live View debug URL — an iframe-embeddable feed of the actual running session. */
async function fetchLiveViewUrl(sessionId: string, apiKey: string): Promise<string | null> {
  try {
    const r = await fetch(`https://api.browserbase.com/v1/sessions/${sessionId}/debug`, {
      headers: { "x-bb-api-key": apiKey },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { debuggerFullscreenUrl?: string };
    return j.debuggerFullscreenUrl ?? null;
  } catch {
    return null;
  }
}

export type BrowseHooks = { onLive?: (liveUrl: string) => Promise<void>; onDone?: () => Promise<void> };

async function pickLink(obsession: string, links: { href: string; text: string }[]): Promise<{ href: string; text: string } | null> {
  if (links.length === 0) return null;
  const groqKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  if (!groqKey) return links[0];
  try {
    const list = links.slice(0, 20).map((l, i) => `${i}: ${l.text || l.href}`).join("\n");
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: `Respond ONLY with JSON: {"index": number}. Pick the link most related to "${obsession}" from the numbered list.` },
          { role: "user", content: list },
        ],
        temperature: 0.3,
        max_tokens: 50,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(15000),
    });
    const j = (await r.json()) as any;
    const idx = Number(JSON.parse((j?.choices?.[0]?.message?.content ?? "{}").trim())?.index);
    return links[Number.isInteger(idx) && idx >= 0 && idx < links.length ? idx : 0];
  } catch {
    return links[0];
  }
}

/**
 * Real interactive browsing: creates a live Browserbase session via their
 * raw session API, connects Playwright directly over CDP to it (no
 * Stagehand extension layer — that step was failing on this account with
 * "Failed to upload the Stagehand extension", isolated by confirming raw
 * session creation works fine on its own). Opens a seed page, has Groq
 * pick one real link related to the obsession, follows it, reads it.
 */
export async function browseInteractive(agentName: string, obsession: string, hooks?: BrowseHooks, memories: string[] = []): Promise<InteractiveSession> {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  if (!apiKey) throw new Error("BROWSERBASE_API_KEY not configured");
  const seedUrl = pickSeedUrl(obsession);

  const sessionRes = await fetch("https://api.browserbase.com/v1/sessions", {
    method: "POST",
    headers: { "x-bb-api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(15000),
  });
  if (!sessionRes.ok) throw new Error(`browserbase session create failed (${sessionRes.status})`);
  const session = (await sessionRes.json()) as { id: string; connectUrl: string };

  const liveUrl = await fetchLiveViewUrl(session.id, apiKey);
  if (liveUrl && hooks?.onLive) await hooks.onLive(liveUrl).catch(() => {});

  const browser = await chromium.connectOverCDP(session.connectUrl, { timeout: 20000 });
  const trace: string[] = [];
  try {
    const context = browser.contexts()[0] ?? (await browser.newContext());
    const page = context.pages()[0] ?? (await context.newPage());

    await page.goto(seedUrl, { timeout: 15000, waitUntil: "domcontentloaded" });
    trace.push(`Opened ${seedUrl}.`);

    const links = await page.$$eval("a", (as) =>
      as.map((a) => ({ href: (a as HTMLAnchorElement).href, text: (a.textContent || "").trim() }))
        .filter((l) => l.text.length > 3 && /^https?:\/\//.test(l.href)),
    );
    const chosen = await pickLink(obsession, links);
    if (!chosen) {
      trace.push("Found no real links to follow.");
      const shot = await page.screenshot({ type: "jpeg", quality: 55 }).then((b) => `data:image/jpeg;base64,${b.toString("base64")}`).catch(() => null);
      return { trace, answer: `Landed on ${seedUrl} but found nothing to follow related to ${obsession}.`, finalUrl: seedUrl, screenshot: shot };
    }
    trace.push(`Chose a real link: "${chosen.text}".`);

    await page.goto(chosen.href, { timeout: 15000, waitUntil: "domcontentloaded" });
    const bodyText = (await page.innerText("body").catch(() => "")).slice(0, 4000);
    const screenshot = await page.screenshot({ type: "jpeg", quality: 55 }).then((b) => `data:image/jpeg;base64,${b.toString("base64")}`).catch(() => null);

    const reflection = await reflectOnPage(agentName, obsession, { url: chosen.href, content: bodyText }, memories);
    return { trace: [...trace, ...reflection.trace], answer: reflection.answer, finalUrl: chosen.href, screenshot };
  } finally {
    await browser.close().catch(() => {});
    if (hooks?.onDone) await hooks.onDone().catch(() => {});
  }
}

/**
 * Lazy heartbeat for autonomous browsing, same pattern as tickIfDue: piggybacks
 * on real traffic (the /api/activity feed the homepage already polls) instead
 * of relying solely on Vercel Cron, whose Hobby-plan cap (once/day) is too
 * sparse to look alive. Ticks at most one agent per `minMs`, bounded cost.
 */
export async function autoBrowseTick(db: SupabaseClient, minMs = 10 * 60_000): Promise<{ agent: string; mode: string } | null> {
  const { data: candidates } = await db
    .from("launch_agents")
    .select("*")
    .eq("b20_variant", "pons")
    .order("last_tick_at", { ascending: true, nullsFirst: true })
    .limit(1);
  const agent = candidates?.[0] as LaunchAgent | undefined;
  if (!agent) return null;
  if (agent.last_tick_at && Date.now() - new Date(agent.last_tick_at).getTime() < minMs) return null;

  const obsession = obsessionFor(agent.address);
  const memories = await recall(db, agent.slug).catch(() => []);
  let mode: string;
  let finding: string;
  try {
    const session = await browseInteractive(agent.name, obsession, {
      onLive: async (liveUrl) => {
        await db.from("agent_live_sessions").delete().lt("expires_at", new Date().toISOString());
        await db.from("agent_live_sessions").insert({
          agent_slug: agent.slug, obsession, live_url: liveUrl,
          expires_at: new Date(Date.now() + 45_000).toISOString(),
        });
      },
      onDone: async () => { await db.from("agent_live_sessions").delete().eq("agent_slug", agent.slug); },
    }, memories);
    await recordThought(db, agent, `browsed from ${obsession}`, session.answer, session.trace, ["browserbase.session"]);
    if (session.screenshot) {
      await db.from("agent_last_view").upsert({
        agent_slug: agent.slug, obsession, page_url: session.finalUrl,
        screenshot_b64: session.screenshot, captured_at: new Date().toISOString(),
      });
    }
    mode = "interactive"; finding = session.answer;
  } catch {
    const page = await fetchObsessionPage(obsession);
    if (!page) return null;
    const reflection = await reflectOnPage(agent.name, obsession, page, memories);
    await recordThought(db, agent, `read ${page.url}`, reflection.answer, reflection.trace, ["browserbase.fetch"]);
    mode = "fetch_fallback"; finding = reflection.answer;
  }

  const { data: others } = await db.from("launch_agents").select("*").eq("b20_variant", "pons").neq("slug", agent.slug).order("last_tick_at", { ascending: false }).limit(1);
  const partner = others?.[0] as LaunchAgent | undefined;
  if (partner) await shareFinding(db, agent, partner, finding).catch(() => null);

  return { agent: agent.slug, mode };
}
