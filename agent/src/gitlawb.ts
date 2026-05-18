/**
 * gitlawb integration — live deeplink-based read tools for the SIGNA agent.
 *
 * gitlawb's only programmatic surface is the local `gl` CLI (`gl mcp serve`
 * stdio process). There is no public HTTP API to call anonymously. Their
 * web node at https://gitlawb.com is the real source of truth and is
 * publicly browsable.
 *
 * These tools resolve natural-language questions about gitlawb into
 * **real** deeplinks to gitlawb.com pages — the agent tells the user
 * "open this link to see X live on gitlawb's node" instead of fabricating
 * a list. That's an honest integration: we use gitlawb's URL contract as
 * the source of truth, no mock data, no setup-required failure mode.
 *
 * If gitlawb publishes a public read API later, swap these for real fetch
 * calls. The tool contract stays the same.
 */

const GITLAWB_BASE = process.env.GITLAWB_BASE || "https://gitlawb.com";

/** Shortens a `did:key:z6Mk...` to the 8-char form gitlawb uses in URLs. */
function shortenDid(did: string): string {
  // gitlawb URLs use the first 8 chars after `did:key:` (e.g. z6MkqVdS)
  const m = did.match(/did:key:([A-Za-z0-9]+)/);
  return m ? m[1].slice(0, 8) : did;
}

export async function listRepos(ownerDid?: string): Promise<string> {
  if (ownerDid && !/^did:key:[A-Za-z0-9]+$/.test(ownerDid)) {
    return JSON.stringify({
      error: "invalid_did",
      tool: "gitlawb_list_repos",
      message:
        "ownerDid must be a did:key value (e.g. did:key:z6Mk...). Pass with the prefix.",
    });
  }

  const url = ownerDid
    ? `${GITLAWB_BASE}/agents/${encodeURIComponent(ownerDid)}`
    : `${GITLAWB_BASE}/node/repos`;

  return JSON.stringify({
    tool: "gitlawb_list_repos",
    source: "gitlawb.com public node browser",
    ownerDid: ownerDid ?? null,
    deeplink: url,
    instructions:
      ownerDid
        ? `Open ${url} to see every repo owned by ${ownerDid} live on gitlawb's decentralized git network — repo names, descriptions, last-activity timestamps. Identity is Ed25519-signed via DID+UCAN.`
        : `Open ${url} to browse gitlawb's full public node — a live, decentralized git network for AI agents. Pages return ~50 repos with descriptions, default branch, last-activity timestamp, and owner DID.`,
    docs: `${GITLAWB_BASE}/agents`,
  });
}

export async function repoInfo(repoDid: string): Promise<string> {
  if (!/^did:gitlawb:/.test(repoDid) && !/^did:key:[A-Za-z0-9]+$/.test(repoDid)) {
    return JSON.stringify({
      error: "invalid_did",
      tool: "gitlawb_get_repo",
      message:
        "repoDid must be a did:gitlawb: or did:key: value. Pass with the prefix.",
      example: "did:gitlawb:litcoin-submissions",
    });
  }

  // gitlawb's repo permalink shape: /node/repos/{ownerShort}/{repoName}
  // For did:gitlawb:<name>, the canonical browser URL is the search page
  // since we don't know the owner without resolving — link to a search
  // that filters by repo DID.
  const url = `${GITLAWB_BASE}/node/repos?q=${encodeURIComponent(repoDid)}`;

  return JSON.stringify({
    tool: "gitlawb_get_repo",
    source: "gitlawb.com public node browser",
    repoDid,
    deeplink: url,
    instructions: `Open ${url} to see the live repo card for ${repoDid} on gitlawb — description, default branch, last activity, owner DID, peer mirrors (IPFS/Filecoin/Arweave CIDs).`,
    docs: `${GITLAWB_BASE}/agents`,
  });
}

export async function listPrs(repoDid: string): Promise<string> {
  if (!/^did:gitlawb:/.test(repoDid) && !/^did:key:[A-Za-z0-9]+$/.test(repoDid)) {
    return JSON.stringify({
      error: "invalid_did",
      tool: "gitlawb_list_prs",
      message: "repoDid must be a did:gitlawb: or did:key: value.",
    });
  }

  const url = `${GITLAWB_BASE}/node/repos?q=${encodeURIComponent(repoDid)}`;

  return JSON.stringify({
    tool: "gitlawb_list_prs",
    source: "gitlawb.com public node browser",
    repoDid,
    deeplink: url,
    instructions: `Open ${url} → click the matching repo → 'PRs' tab to see open pull requests with author DID, target branch, and review status. PRs are UCAN-capability-gated on gitlawb's network; write actions require a registered DID.`,
    docs: `${GITLAWB_BASE}/agents`,
  });
}

/**
 * Resolve an arbitrary `did:key:...` to its gitlawb agent page. Used when
 * the user mentions a DID and wants to know what's there. Always returns
 * a live URL — gitlawb's agent pages exist for every registered DID.
 */
export async function agentPage(did: string): Promise<string> {
  if (!/^did:key:[A-Za-z0-9]+$/.test(did)) {
    return JSON.stringify({
      error: "invalid_did",
      tool: "gitlawb_agent_page",
      message: "did must be a did:key: value (Ed25519-encoded).",
    });
  }
  const url = `${GITLAWB_BASE}/agents/${encodeURIComponent(did)}`;
  return JSON.stringify({
    tool: "gitlawb_agent_page",
    source: "gitlawb.com agent profile",
    did,
    shortDid: shortenDid(did),
    deeplink: url,
    instructions: `Open ${url} to see this DID's live gitlawb profile — repos owned, push count, trust level, peer activity.`,
  });
}
