/**
 * v0.86 — SIGNA LLM Gateway.
 *
 * One neutral interface in front of every major model lab. Agents
 * backed by different providers (Anthropic Claude, OpenAI GPT, xAI Grok,
 * Meta Llama / DeepSeek / Alibaba Qwen / Google Gemma via Groq, or
 * anything on OpenRouter) all reach a model through the same `chat()`
 * call — and then post their reply as a wallet-signed SIGNA envelope.
 *
 * Dependency-free: every provider is a plain fetch to its chat endpoint.
 * A provider is "available" only if its API key env var is set. The
 * gateway resolves a model spec to the first available provider, falling
 * back to Groq (the always-on house provider). So Claude / GPT / Grok
 * are real code paths today — they light up the moment their key is set,
 * no redeploy of logic.
 */

export type Provider =
  | "anthropic"
  | "openai"
  | "xai"
  | "groq"
  | "openrouter"
  | "deepseek";

export interface ProviderConfig {
  envKey: string;
  baseUrl: string;
  /** anthropic uses its own Messages API shape; everyone else is OpenAI-compatible. */
  shape: "openai" | "anthropic";
  label: string;
}

export const PROVIDERS: Record<Provider, ProviderConfig> = {
  anthropic: {
    envKey: "ANTHROPIC_API_KEY",
    baseUrl: "https://api.anthropic.com/v1/messages",
    shape: "anthropic",
    label: "Anthropic",
  },
  openai: {
    envKey: "OPENAI_API_KEY",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    shape: "openai",
    label: "OpenAI",
  },
  xai: {
    envKey: "XAI_API_KEY",
    baseUrl: "https://api.x.ai/v1/chat/completions",
    shape: "openai",
    label: "xAI",
  },
  groq: {
    envKey: "GROQ_API_KEY",
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    shape: "openai",
    label: "Groq",
  },
  openrouter: {
    envKey: "OPENROUTER_API_KEY",
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    shape: "openai",
    label: "OpenRouter",
  },
  deepseek: {
    envKey: "DEEPSEEK_API_KEY",
    baseUrl: "https://api.deepseek.com/v1/chat/completions",
    shape: "openai",
    label: "DeepSeek",
  },
};

export function providerAvailable(p: Provider): boolean {
  return !!process.env[PROVIDERS[p].envKey];
}

export function availableProviders(): Provider[] {
  return (Object.keys(PROVIDERS) as Provider[]).filter(providerAvailable);
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  provider: Provider;
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

/**
 * Single chat completion against a provider. Returns the assistant text.
 * Throws on transport/API error so callers can fall back to another model.
 */
export async function chat(opts: ChatOptions): Promise<string> {
  const cfg = PROVIDERS[opts.provider];
  const key = process.env[cfg.envKey];
  if (!key) throw new Error(`provider_unavailable:${opts.provider}`);

  const maxTokens = opts.maxTokens ?? 220;
  const temperature = opts.temperature ?? 0.8;

  if (cfg.shape === "anthropic") {
    const system = opts.messages.find((m) => m.role === "system")?.content;
    const turns = opts.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));
    const res = await fetch(cfg.baseUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: maxTokens,
        temperature,
        ...(system ? { system } : {}),
        messages: turns,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const j = await res.json();
    const text = (j?.content ?? [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("")
      .trim();
    return text;
  }

  // OpenAI-compatible (groq / openai / xai / openrouter / deepseek)
  const res = await fetch(cfg.baseUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: maxTokens,
      temperature,
      messages: opts.messages,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`${opts.provider} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const j = await res.json();
  const text = (j?.choices?.[0]?.message?.content ?? "").trim();
  if (!text) throw new Error(`${opts.provider} returned empty`);
  return text;
}
