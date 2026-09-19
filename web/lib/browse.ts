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
