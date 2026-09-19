import { browserbase } from "@browserbasehq/stagehand";

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

/**
 * Direct, single-shot Groq call — deliberately NOT runBrain2, which is an
 * agentic tool-calling loop that ignores inline text and always tries to
 * invoke its own capabilities instead of digesting what's handed to it.
 * This just asks the model to react to real page content, nothing else.
 */
export async function reflectOnPage(agentName: string, obsession: string, page: { url: string; content: string }): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b"; // llama-3.3-70b-versatile was removed from Groq entirely
  if (!apiKey) return `(no GROQ_API_KEY configured — can't reflect on ${page.url})`;
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: `You are ${agentName}, an onchain agent obsessed with "${obsession}". Stay in character, be concise.` },
        { role: "user", content: `You just read this real page (${page.url}):\n\n${page.content}\n\nWhat's the single most interesting thing here? 2 sentences, no preamble.` },
      ],
      temperature: 0.7,
      max_tokens: 200,
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`groq reflect failed (${r.status})`);
  const j = (await r.json()) as any;
  return (j?.choices?.[0]?.message?.content ?? "").trim() || "(no reflection)";
}
