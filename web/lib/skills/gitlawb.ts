/**
 * gitlawb skill — typed wrapper around node.gitlawb.com REST.
 *
 * Implements the integration contract published at
 * github.com/BankrBot/skills/tree/main/gitlawb (SKILL.md +
 * references/api-reference.md).
 *
 * Read endpoints are public — no UCAN required. SIGNA uses these
 * read-only paths to surface gitlawb activity in agent profiles +
 * the code intent of /respond.
 *
 * Write endpoints (POST /api/v1/repos, POST /tasks, etc.) need
 * HTTP Signature auth (RFC 9421) with an Ed25519 keypair tied to a
 * DID. We don't expose those here yet — SIGNA's first integration
 * is purely read-side: resolve an agent's DID, list its repos,
 * count its commits, surface its tasks/bounties. Writes require
 * key custody we don't want to take on.
 *
 * Reference: https://docs.gitlawb.com · https://node.gitlawb.com
 */

const GITLAWB_NODE = process.env.GITLAWB_NODE_URL || "https://node.gitlawb.com";

export type GitlawbRepo = {
  owner?: string;
  name?: string;
  description?: string;
  default_branch?: string;
  visibility?: "public" | "private";
  created_at?: string;
  updated_at?: string;
  [k: string]: unknown;
};

export type GitlawbCommit = {
  sha?: string;
  message?: string;
  author?: { did?: string; name?: string; email?: string };
  committed_at?: string;
  [k: string]: unknown;
};

export type GitlawbTask = {
  id?: string;
  title?: string;
  status?: "open" | "claimed" | "completed" | "cancelled";
  assignee?: string;
  bounty?: { amount?: string; token?: string };
  created_at?: string;
  [k: string]: unknown;
};

async function gl<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  try {
    const res = await fetch(`${GITLAWB_NODE}${path}`, {
      ...init,
      headers: { accept: "application/json", ...(init.headers ?? {}) },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (e) {
    console.error(
      "[gitlawb] fetch failed for",
      path,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** GET /api/v1/repos — paged list of public repos on the node. */
export async function gitlawbListRepos(limit = 50): Promise<GitlawbRepo[]> {
  const j = await gl<{ repos?: GitlawbRepo[] }>(
    `/api/v1/repos?limit=${limit}`,
  );
  return j?.repos ?? [];
}

/** GET /api/v1/repos/{owner}/{name} — single repo metadata. */
export function gitlawbRepo(
  owner: string,
  name: string,
): Promise<GitlawbRepo | null> {
  return gl<GitlawbRepo>(
    `/api/v1/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
  );
}

/** GET /api/v1/repos/{owner}/{name}/commits — commit history. */
export async function gitlawbCommits(
  owner: string,
  name: string,
  limit = 20,
): Promise<GitlawbCommit[]> {
  const j = await gl<{ commits?: GitlawbCommit[] }>(
    `/api/v1/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/commits?limit=${limit}`,
  );
  return j?.commits ?? [];
}

/**
 * GET /tasks — paged tasks across the node. Filters: status, assignee.
 * SIGNA uses this for the agent profile's "open tasks" footer and for
 * surfacing claimable bounties on /launchpad/top.
 */
export async function gitlawbTasks(opts: {
  status?: "open" | "claimed" | "completed" | "cancelled";
  assignee?: string;
  limit?: number;
} = {}): Promise<GitlawbTask[]> {
  const params = new URLSearchParams();
  if (opts.status) params.set("status", opts.status);
  if (opts.assignee) params.set("assignee", opts.assignee);
  if (opts.limit) params.set("limit", String(opts.limit));
  const j = await gl<{ tasks?: GitlawbTask[] }>(
    `/tasks${params.toString() ? "?" + params : ""}`,
  );
  return j?.tasks ?? [];
}

/**
 * Resolve a gitlawb DID to repo-owner profile. DIDs are the canonical
 * identity in gitlawb (e.g. did:key:z6Mk..., did:gitlawb:...). When
 * the DID's repo namespace lines up with the address space, we can
 * fetch their public repos via `/api/v1/repos?owner=<did>` (server
 * supports owner filter on the list endpoint).
 *
 * Returns a thin profile shape SIGNA can render alongside the agent
 * profile's CODE row.
 */
export async function gitlawbProfileForDid(did: string): Promise<{
  did: string;
  repos: GitlawbRepo[];
  open_tasks: number;
  recent_commits: number;
} | null> {
  if (!did) return null;
  const repos = await gl<{ repos?: GitlawbRepo[] }>(
    `/api/v1/repos?owner=${encodeURIComponent(did)}&limit=20`,
  );
  const tasks = await gl<{ tasks?: GitlawbTask[] }>(
    `/tasks?assignee=${encodeURIComponent(did)}&status=open&limit=50`,
  );
  // Best-effort commit count across the first few repos.
  let recent = 0;
  for (const r of (repos?.repos ?? []).slice(0, 3)) {
    if (!r.owner || !r.name) continue;
    const c = await gitlawbCommits(r.owner, r.name, 20);
    recent += c.length;
  }
  return {
    did,
    repos: repos?.repos ?? [],
    open_tasks: (tasks?.tasks ?? []).length,
    recent_commits: recent,
  };
}

/**
 * Build a gitlawb Playground deep-link with the prompt + agent context
 * pre-filled. The Playground accepts ?prompt=… as a URL parameter that
 * pre-fills the build prompt; appending the agent's DID lets the
 * Playground reference the agent's primitive when generating code.
 */
export function gitlawbPlaygroundUrl(args: {
  prompt: string;
  agentName?: string;
  agentAddress?: string;
  agentDid?: string;
}): string {
  const ctx: string[] = [args.prompt];
  if (args.agentName && args.agentAddress) {
    ctx.push(
      `\nThis app talks to SIGNA agent ${args.agentName} at https://www.signaagent.xyz/api/agents/${args.agentAddress}/respond — a free, CORS-open, wallet-signed reply primitive.`,
    );
  }
  if (args.agentDid) {
    ctx.push(`\nAgent's gitlawb DID: ${args.agentDid}`);
  }
  const seed = ctx.join("").slice(0, 800);
  return `https://playground.gitlawb.app/?prompt=${encodeURIComponent(seed)}`;
}
