/**
 * Bankr skill — typed wrapper around api.bankr.bot.
 *
 * Implements the integration contract published at
 * github.com/BankrBot/skills/tree/main/bankr (SKILL.md).
 * Surfaces every endpoint SIGNA's `/respond` router + wallet flows
 * need: wallet info, portfolio, transfer, sign, submit, agent prompt
 * (with thread continuity), token launches, and the public resolver.
 *
 * Why this lives at lib/skills/bankr.ts:
 *
 *   - One place to encode the Bankr contract so other route handlers
 *     don't have to remember headers, polling cadence, or thread
 *     semantics. The /respond facts/action intents and the /me/trade
 *     flow all funnel through here.
 *
 *   - When Bankr ships a breaking change (versioned at api.bankr.bot)
 *     we update one file. No more drift between digest cron + /trade
 *     + /respond.
 *
 *   - Pure functions, no global state. Each call takes the API key
 *     as a string param — caller is responsible for decrypting it
 *     from the vault (decryptOpaque in key-vault.ts) first.
 *
 * Reference: https://github.com/BankrBot/skills/blob/main/bankr/SKILL.md
 */

const BANKR_BASE = process.env.BANKR_API_URL || "https://api.bankr.bot";

export type BankrChain =
  | "base"
  | "ethereum"
  | "polygon"
  | "solana"
  | "unichain"
  | "arbitrum"
  | "bnb"
  | "world";

export type BankrWalletInfo = {
  address?: string;
  chains?: BankrChain[];
  [k: string]: unknown;
};

export type BankrPortfolioPosition = {
  symbol?: string;
  name?: string;
  chain?: BankrChain;
  balance?: string;
  price_usd?: string | number;
  value_usd?: string | number;
  change_24h_pct?: number | null;
  contract_address?: string;
  [k: string]: unknown;
};

export type BankrPortfolio = {
  total_usd?: number;
  positions?: BankrPortfolioPosition[];
  pnl_24h_usd?: number;
  [k: string]: unknown;
};

export type BankrAgentJob = {
  id?: string;
  jobId?: string;
  threadId?: string;
  status?: "queued" | "running" | "completed" | "failed" | "cancelled";
  response?: string;
  result?: {
    transactionHash?: string;
    tokenAddress?: string;
    tokenSymbol?: string;
    amountIn?: string;
    amountOut?: string;
    [k: string]: unknown;
  };
  error?: string;
  [k: string]: unknown;
};

/** Common error shape — wraps Bankr's per-endpoint error JSON. */
export class BankrError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function bankrFetch<T>(
  apiKey: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BANKR_BASE}${path}`, {
    ...init,
    headers: {
      "X-API-Key": apiKey,
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new BankrError(
      `Bankr ${path} → HTTP ${res.status}`,
      res.status,
      body,
    );
  }
  return body as T;
}

/** GET /wallet/me — cheapest auth check; returns address + chains. */
export function bankrWalletMe(apiKey: string): Promise<BankrWalletInfo> {
  return bankrFetch<BankrWalletInfo>(apiKey, "/wallet/me");
}

/**
 * GET /wallet/portfolio — multi-chain balances + USD valuation.
 *
 * `include` lets you progressively load PnL / NFTs without paying the
 * cost on the cheap default call. `chains` filters to a subset.
 */
export function bankrPortfolio(
  apiKey: string,
  opts: {
    include?: Array<"pnl" | "nfts">;
    chains?: BankrChain[];
  } = {},
): Promise<BankrPortfolio> {
  const params = new URLSearchParams();
  if (opts.include?.length) params.set("include", opts.include.join(","));
  if (opts.chains?.length) params.set("chains", opts.chains.join(","));
  const qs = params.toString();
  return bankrFetch<BankrPortfolio>(
    apiKey,
    `/wallet/portfolio${qs ? "?" + qs : ""}`,
  );
}

/**
 * POST /wallet/transfer — direct send. Subject to wallet-level
 * spending limits + per-key `allowedRecipients` policy. Synchronous;
 * returns the tx hash on success.
 */
export function bankrTransfer(
  apiKey: string,
  args: {
    to: string;
    token: string;
    amount: string;
    chain?: BankrChain;
  },
): Promise<{ transactionHash?: string; [k: string]: unknown }> {
  return bankrFetch(apiKey, "/wallet/transfer", {
    method: "POST",
    body: JSON.stringify(args),
  });
}

/**
 * GET /addresses/resolve — public, no auth. Accepts 0x addresses,
 * ENS / Basenames (.eth, .base.eth, .cb.id), Twitter / Farcaster
 * handles. SIGNA uses this so any @mention in a chat composer can
 * be resolved without our own indexer.
 */
export async function bankrResolveRecipient(
  value: string,
  type?: "address" | "ens" | "twitter" | "farcaster",
): Promise<{ address?: string; type?: string; [k: string]: unknown } | null> {
  const params = new URLSearchParams({ value });
  if (type) params.set("type", type);
  try {
    const res = await fetch(`${BANKR_BASE}/addresses/resolve?${params}`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as { address?: string };
  } catch {
    return null;
  }
}

/**
 * GET /token-launches — public, no auth. Recent token launches via
 * Clanker (Base) / Raydium (Solana). Used to surface launches on the
 * SIGNA /launchpad page.
 */
export async function bankrRecentLaunches(limit = 20): Promise<
  Array<{
    address?: string;
    symbol?: string;
    name?: string;
    chain?: string;
    launched_at?: string;
    creator?: string;
    [k: string]: unknown;
  }>
> {
  try {
    const res = await fetch(
      `${BANKR_BASE}/token-launches?limit=${limit}`,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) return [];
    const j = (await res.json()) as { launches?: unknown[] };
    return (j.launches ?? []) as Array<{ address?: string }>;
  } catch {
    return [];
  }
}

/**
 * POST /agent/prompt — submit a natural-language prompt. Async. Returns
 * jobId + threadId. Pass threadId on subsequent calls to maintain
 * context (Bankr remembers per-thread state).
 */
export function bankrSubmitPrompt(
  apiKey: string,
  prompt: string,
  threadId?: string,
): Promise<BankrAgentJob> {
  return bankrFetch<BankrAgentJob>(apiKey, "/agent/prompt", {
    method: "POST",
    body: JSON.stringify(threadId ? { prompt, threadId } : { prompt }),
  });
}

/** GET /agent/job/{jobId} — single status poll. */
export function bankrGetJob(
  apiKey: string,
  jobId: string,
): Promise<BankrAgentJob> {
  return bankrFetch<BankrAgentJob>(apiKey, `/agent/job/${jobId}`);
}

/**
 * Full submit + poll loop. Returns the final job state once the job
 * is `completed` / `failed` / `cancelled` or `timeoutMs` is hit. The
 * SIGNA /me/trade endpoint uses this — caller passes the user's
 * decrypted API key + a natural-language prompt and gets back a
 * settled (or honestly-failed) job.
 */
export async function bankrPromptAndWait(
  apiKey: string,
  prompt: string,
  opts: {
    threadId?: string;
    pollIntervalMs?: number;
    timeoutMs?: number;
  } = {},
): Promise<BankrAgentJob> {
  const submit = await bankrSubmitPrompt(apiKey, prompt, opts.threadId);
  const jobId = submit.jobId || submit.id;
  if (!jobId) return submit;
  const interval = opts.pollIntervalMs ?? 1500;
  const deadline = Date.now() + (opts.timeoutMs ?? 30_000);
  let last = submit;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval));
    try {
      const tick = await bankrGetJob(apiKey, jobId);
      last = tick;
      if (
        tick.status === "completed" ||
        tick.status === "failed" ||
        tick.status === "cancelled"
      ) {
        return last;
      }
    } catch {
      // transient — keep polling
    }
  }
  return last;
}
