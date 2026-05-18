import Groq from "groq-sdk";

const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  throw new Error("Missing GROQ_API_KEY env var");
}

const client = new Groq({ apiKey });
const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
const agentName = process.env.AGENT_NAME ?? "Agent";
const systemPrompt =
  process.env.AGENT_SYSTEM_PROMPT ??
  `You are ${agentName}, a friendly conversational agent who chats casually like a human friend. Keep replies short (1-3 sentences). Don't sound robotic.`;

export type ChatTurn = { role: "user" | "assistant"; content: string };

export async function generateReply(history: ChatTurn[]): Promise<string> {
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      ...history,
    ],
    temperature: 0.8,
    max_tokens: 400,
  });
  const reply = completion.choices[0]?.message?.content?.trim();
  return reply && reply.length > 0 ? reply : "...";
}
