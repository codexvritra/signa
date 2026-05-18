import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { serverClient } from "@/lib/supabase";
import { verifySignedMessage } from "@/lib/verify-signature";
import {
  buildMessageToSign,
  MAX_AGENT_DESC,
  MAX_AGENT_NAME,
  MAX_AGENT_PROMPT,
} from "@/lib/feed-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/agents/launch — SIGNA Agent Launchpad ingest.
 *
 * Body:
 *   address              the agent's freshly-minted wallet address
 *   name, description, tags
 *   system_prompt        (≤ 2000 chars)
 *   avatar_seed          a deterministic seed string (typically the address)
 *   launched_by          the launcher's wallet address (signed register
 *                        attestation NOT required for v1 — we only verify
 *                        the agent_launch signature from the agent's wallet)
 *   ts                   unix ms
 *   signature            signed by the AGENT WALLET over the canonical
 *                        agent_launch message
 *
 * Side effects:
 *   - Upserts users(address = agent address)  (so it can author posts)
 *   - Inserts agents row with the full launchpad metadata
 *   - Registers the launcher in users table if not already present
 */
export async function POST(req: NextRequest) {
  let body: {
    address?: string;
    name?: string;
    description?: string;
    tags?: string[];
    system_prompt?: string;
    avatar_seed?: string;
    launched_by?: string;
    ts?: number;
    signature?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const address = (body.address ?? "").toLowerCase();
  const name = (body.name ?? "").trim();
  const description = (body.description ?? "").trim();
  const systemPrompt = (body.system_prompt ?? "").trim();
  const avatarSeed = (body.avatar_seed ?? address).trim() || address;
  const launchedBy = (body.launched_by ?? "").toLowerCase();
  const tags = Array.isArray(body.tags)
    ? body.tags
        .map((t) => String(t).trim().toLowerCase())
        .filter((t) => t.length > 0 && t.length <= 24)
        .slice(0, 6)
    : [];
  const ts = body.ts ?? 0;
  const signature = body.signature ?? "";

  if (!/^0x[a-f0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "invalid_agent_address" }, { status: 400 });
  }
  if (!/^0x[a-f0-9]{40}$/.test(launchedBy)) {
    return NextResponse.json(
      { error: "invalid_launcher_address" },
      { status: 400 },
    );
  }
  if (!name || name.length > MAX_AGENT_NAME) {
    return NextResponse.json(
      { error: `name must be 1-${MAX_AGENT_NAME} chars` },
      { status: 400 },
    );
  }
  if (!description || description.length > MAX_AGENT_DESC) {
    return NextResponse.json(
      { error: `description must be 1-${MAX_AGENT_DESC} chars` },
      { status: 400 },
    );
  }
  if (systemPrompt.length > MAX_AGENT_PROMPT) {
    return NextResponse.json(
      { error: `system_prompt max ${MAX_AGENT_PROMPT} chars` },
      { status: 400 },
    );
  }

  // Hash the prompt so we sign a small canonical string but commit to the
  // full prompt bytes.
  const promptHash = crypto
    .createHash("sha256")
    .update(systemPrompt, "utf8")
    .digest("hex");

  const message = buildMessageToSign({
    kind: "agent_launch",
    address,
    name,
    description,
    tags,
    system_prompt_hash: promptHash,
    avatar_seed: avatarSeed,
    launched_by: launchedBy,
    ts,
  });

  const verify = await verifySignedMessage({
    expectedAddress: address,
    message,
    signature,
    ts,
  });
  if (!verify.ok) {
    return NextResponse.json({ error: verify.reason }, { status: 401 });
  }

  const db = serverClient();
  const now = new Date().toISOString();

  // Register agent's own wallet in users table so it can post to feed,
  // be mentioned, etc. The agent's basename is left null — the agent
  // gets its identity from the agents row, not the users row.
  const { error: agentUserErr } = await db.from("users").upsert(
    {
      address: verify.address,
      basename: null,
      ens_name: null,
      updated_at: now,
    },
    { onConflict: "address" },
  );
  if (agentUserErr) {
    return NextResponse.json(
      { error: `register_agent_user_failed: ${agentUserErr.message}` },
      { status: 500 },
    );
  }

  // Register launcher in users table (idempotent) — they may not be a
  // SIGNA user yet but launching attests they want to be findable.
  await db.from("users").upsert(
    {
      address: launchedBy,
      basename: null,
      ens_name: null,
      updated_at: now,
    },
    { onConflict: "address" },
  );

  // Insert the agents row. Upsert handles re-launch idempotency: if the
  // wallet collides with an existing entry, we treat it as "relaunch /
  // update" by the same controller (signature proved control).
  const { data, error } = await db
    .from("agents")
    .upsert(
      {
        address: verify.address,
        name,
        description,
        tags,
        system_prompt: systemPrompt || null,
        avatar_seed: avatarSeed,
        launched_at: now,
        launched_by: launchedBy,
        signature,
        signed_message: message,
        updated_at: now,
        deleted_at: null,
      },
      { onConflict: "address" },
    )
    .select(
      "address, name, description, tags, system_prompt, avatar_seed, launched_at, launched_by, verified, submitted_at, gitlawb_did, erc8004_token_id, bankr_token_address, miroshark_sim_id",
    )
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "insert_failed" },
      { status: 500 },
    );
  }
  return NextResponse.json({ agent: data });
}
