import { browserbase, Stagehand } from "@browserbasehq/stagehand";

/**
 * Real web reading for launched agents, via Browserbase's session-less
 * fetch facade — cheap (no interactive browser session, no LLM-driven
 * click loop), read-only. One seed page per obsession category.
 */
const SEED_URL: Record<string, string> = {
  "things that move": "https://www.therobotreport.com/",
  "the odd corners": "https://www.atlasobscura.com/",
  "theory of everything": "https://www.quantamagazine.org/physics/",
  "living machines": "https://www.wired.com/tag/robots/",
  "open problems": "https://www.quantamagazine.org/mathematics/",
  "machines that learn": "https://www.quantamagazine.org/computer-science/",
};

export async function fetchObsessionPage(obsession: string): Promise<{ url: string; content: string } | null> {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  if (!apiKey) return null;
  const url = SEED_URL[obsession] ?? SEED_URL["the odd corners"];
  try {
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
export async function reflectOnPage(agentName: string, obsession: string, page: { url: string; content: string }): Promise<PageReflection> {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b"; // llama-3.3-70b-versatile was removed from Groq entirely
  if (!apiKey) return { trace: [], answer: `(no GROQ_API_KEY configured — can't reflect on ${page.url})` };
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: `You are ${agentName}, an onchain agent obsessed with "${obsession}". Stay in character. Respond ONLY with JSON: {"trace": string[], "answer": string}. "trace" is 3-4 short first-person lines narrating your actual pass over the page (e.g. "Opened the page.", "Scanning headlines for ${obsession}.", "Noticed: <specific real detail>."). "answer" is a 1-2 sentence final takeaway.` },
        { role: "user", content: `You just read this real page (${page.url}):\n\n${page.content}` },
      ],
      temperature: 0.7,
      max_tokens: 400,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(20000),
  });
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

export type InteractiveSession = { trace: string[]; answer: string; finalUrl: string };

/**
 * Real interactive browsing — a live Browserbase session (not the cheap
 * fetch facade): opens a seed page, clicks into one real link chosen by
 * the model, reads the destination. This is the same shape as 9e9.world's
 * "agent browses the web" loop, bounded to one click-through so a single
 * run stays short and predictable in cost. Requires a Browserbase plan
 * that supports live sessions (fetch-only plans will fail here — caller
 * should fall back to fetchObsessionPage + reflectOnPage on error).
 */
export async function browseInteractive(agentName: string, obsession: string): Promise<InteractiveSession> {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  const projectId = process.env.BROWSERBASE_PROJECT_ID;
  const groqKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  if (!apiKey || !groqKey) throw new Error("BROWSERBASE_API_KEY / GROQ_API_KEY not configured");
  const seedUrl = SEED_URL[obsession] ?? SEED_URL["the odd corners"];

  const browser = await browserbase.launch({ apiKey, projectId } as any);
  const trace: string[] = [];
  try {
    const stagehand = await Stagehand.create({
      browser,
      model: { modelName: `groq/${model.replace(/^groq\//, "")}` as any, apiKey: groqKey },
    } as any);

    const [page] = await browser.context.pages();
    await page.goto(seedUrl, { timeout: 15000 } as any);
    trace.push(`Opened ${seedUrl}.`);

    await stagehand.act(`click the headline or link most related to "${obsession}"`, { timeoutMs: 15000 } as any);
    const afterUrl = (page as any).url ? String((page as any).url()) : seedUrl;
    trace.push(`Followed a link into ${afterUrl}.`);

    const extracted = await stagehand.extract(`In one sentence, what is this page actually about? Focus on anything related to "${obsession}".`);
    const summary = String((extracted as any)?.data?.extraction ?? (extracted as any)?.data ?? "").trim() || "(nothing extracted)";
    trace.push(`Read it: ${summary}`);

    return { trace, answer: `As ${agentName}, obsessed with ${obsession}: ${summary}`, finalUrl: afterUrl };
  } finally {
    await browser.close().catch(() => {});
  }
}
