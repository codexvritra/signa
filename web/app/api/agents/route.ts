import { NextRequest, NextResponse } from "next/server";
import { serverClient, supabase } from "@/lib/supabase";
import { verifySignedMessage } from "@/lib/verify-signature";
import {
  buildMessageToSign,
  MAX_AGENT_DESC,
  MAX_AGENT_NAME,
} from "@/lib/feed-types";
import { getHolderStatus } from "@/lib/holder-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/agents — list all active (non-deleted) agents, newest first.
 * Enriches each row with the agent wallet's on-chain holder status across
 * Bankr / gitlawb / Miroshark / USDC, so the UI can show partner-token
 * holdings and the "Ecosystem" status (holds ≥ 1 partner token).
 */
export async function GET() {
  const { data, error } = await supabase
    .from("agents")
    .select(
      "address, name, description, tags, verified, submitted_at, launched_at, launched_by, avatar_seed, gitlawb_did, erc8004_token_id, bankr_token_address, miroshark_sim_id",
    )
    .is("deleted_at", null)
    .order("verified", { ascending: false })
    .order("submitted_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const agents = data ?? [];

  // Enrich with holder status in parallel. Errors per-agent don't break the list.
  const enriched = await Promise.all(
    agents.map(async (a) => {
      try {
        const status = await getHolderStatus(a.address);
        return {
          ...a,
          holdings: status.holdings,
          is_ecosystem: status.isEcosystemMember,
        };
      } catch {
        return { ...a, holdings: [], is_ecosystem: false };
      }
    }),
  );
  return NextResponse.json({ agents: enriched });
}

/**
 * POST /api/agents — submit (or update) an agent.
 *   Body: { address, name, description, tags, ts, signature }
 *   Signature MUST be from the agent's wallet (verified against `address`).
 *   This proves the submitter controls the agent's private key.
 */
export async function POST(req: NextRequest) {
  let body: {
    address?: string;
    name?: string;
    description?: string;
    tags?: string[];
    ts?: number;
    signature?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const address = (body.address ?? "").toLowerCase();
  const name = (body.name ?? "").trim();
  const description = (body.description ?? "").trim();
  const tags = Array.isArray(body.tags)
    ? body.tags
        .map((t) => String(t).trim().toLowerCase())
        .filter((t) => t.length > 0 && t.length <= 24)
        .slice(0, 6)
    : [];
  const ts = body.ts ?? 0;
  const signature = body.signature ?? "";

  if (!/^0x[a-f0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
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

  const message = buildMessageToSign({
    kind: "agent_submit",
    address,
    name,
    description,
    tags,
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
  const { data, error } = await db
    .from("agents")
    .upsert(
      {
        address: verify.address,
        name,
        description,
        tags,
        signature,
        signed_message: message,
        updated_at: new Date().toISOString(),
        deleted_at: null,
      },
      { onConflict: "address" },
    )
    .select("address, name, description, tags, verified, submitted_at")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "insert failed" },
      { status: 500 },
    );
  }
  return NextResponse.json({ agent: data });
}
