import type { LaunchAgent } from "./launchpad";

export type NextAction = { action: "browse" | "predict" | "message" | "idle"; reason: string };

/**
 * Phase 4 of the roadmap: "think for itself." Every previous cycle was a
 * hardcoded script — always browse, every 3rd tick also predict. This is
 * the actual decision: given its own memory and track record, the agent
 * picks its next move. Cheap (one small JSON-mode Groq call), and falls
 * back to "browse" on any failure so the worker never stalls on a bad
 * decision call.
 */
export async function decideNextAction(agent: LaunchAgent, memories: string[], track: string[], hasPartner: boolean): Promise<NextAction> {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";
  if (!apiKey) return { action: "browse", reason: "no GROQ_API_KEY configured — defaulting to browse" };

  const memNote = memories.length
    ? `Recent memories:\n${memories.slice(0, 5).map((m) => `- ${m}`).join("\n")}`
    : "No memories yet — this agent is just getting started.";
  const trackNote = track.length ? `Your prediction track record so far: ${track.join(", ")}` : "No resolved predictions yet.";
  const options = [
    "browse — go read something new on the live web related to your obsession",
    "predict — research and stake a real, publicly scored directional call on a stock",
    hasPartner ? "message — share something you've learned with another live agent" : null,
    "idle — nothing worth acting on this cycle, do nothing",
  ].filter(Boolean).join("\n");

  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: `You are ${agent.name}, a live onchain agent. Mission: ${agent.mission}\n${agent.persona ? `Style: ${agent.persona}\n` : ""}Decide your OWN next action for this cycle — don't default to the same choice out of habit. Respond ONLY with JSON: {"action": "browse"|"predict"|"message"|"idle", "reason": string}. "reason" is one short sentence of your own real reasoning, not a template.\n\nOptions:\n${options}`,
          },
          { role: "user", content: `${memNote}\n\n${trackNote}\n\nWhat do you do this cycle, and why?` },
        ],
        temperature: 0.85,
        max_tokens: 150,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return { action: "browse", reason: `decision call failed (${r.status}) — defaulting to browse` };
    const j = (await r.json()) as any;
    const parsed = JSON.parse((j?.choices?.[0]?.message?.content ?? "{}").trim());
    const valid: NextAction["action"][] = ["browse", "predict", "message", "idle"];
    const action: NextAction["action"] = valid.includes(parsed.action) ? parsed.action : "browse";
    return { action, reason: String(parsed.reason ?? "").trim().slice(0, 300) || "no reason given" };
  } catch {
    return { action: "browse", reason: "decision call errored — defaulting to browse" };
  }
}
