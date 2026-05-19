import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { verifySignedMessage } from "@/lib/verify-signature";
import { decryptOpaque } from "@/lib/key-vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/me/trade
 *
 * Body: { address, prompt, ts, signature }
 *
 * Executes a natural-language trade via the user's connected Bankr
 * Agent API key. SIGNA acts only as the relay — Bankr handles the
 * actual swap against the user's Bankr-managed wallet.
 *
 * Flow:
 *   1. Verify the SIGNA wallet signature (proves the caller is the
 *      account-holder, not someone spoofing the address field)
 *   2. Decrypt the stored Bankr key via the AES-256-GCM vault
 *   3. POST { prompt } to https://api.bankr.bot/agent/prompt → jobId
 *   4. Poll https://api.bankr.bot/agent/job/{jobId} every 1.5s up to
 *      30s for status === 'completed' / 'failed'
 *   5. Return the result so the chat UI can render an XMTP-style
 *      TransactionReference card inline
 *
 * Never logs the decrypted key. Never returns it.
 */

const BANKR = "https://api.bankr.bot";
const POLL_INTERVAL_MS = 1500;
const POLL_MAX_MS = 30_000;

type BankrJob = {
  id?: string;
  jobId?: string;
  status?: "queued" | "running" | "completed" | "failed";
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: NextRequest) {
  let body: {
    address?: string;
    prompt?: string;
    ts?: number;
    signature?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const address = (body.address ?? "").toLowerCase();
  const prompt = (body.prompt ?? "").trim();
  const ts = body.ts ?? 0;
  const signature = body.signature ?? "";

  if (!/^0x[a-f0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "invalid_address" }, { status: 400 });
  }
  if (!prompt || prompt.length > 500) {
    return NextResponse.json(
      { error: "prompt_required_max_500" },
      { status: 400 },
    );
  }

  // Verify a fresh signature over the prompt + ts so a stolen request
  // can't be replayed against a different prompt.
  const message = [
    `SIGNA trade v1`,
    `ts:${ts}`,
    `address:${address}`,
    `prompt:${prompt}`,
  ].join("\n");
  const verify = await verifySignedMessage({
    expectedAddress: address,
    message,
    signature,
    ts,
  });
  if (!verify.ok) {
    return NextResponse.json({ error: verify.reason }, { status: 401 });
  }

  // Pull the encrypted key
  const db = serverClient();
  const { data: user, error: userErr } = await db
    .from("users")
    .select("bankr_api_key_encrypted")
    .eq("address", address)
    .maybeSingle();
  if (userErr || !user?.bankr_api_key_encrypted) {
    return NextResponse.json(
      {
        error: "bankr_not_connected",
        message:
          "Connect your Bankr Agent API key on /me first. Without it, SIGNA has nothing to send to Bankr.",
      },
      { status: 412 },
    );
  }

  let apiKey: string;
  try {
    apiKey = decryptOpaque(user.bankr_api_key_encrypted);
  } catch (e) {
    return NextResponse.json(
      {
        error: "vault_decrypt_failed",
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }

  // (1) Submit the prompt to Bankr
  let submitJson: BankrJob;
  try {
    const submit = await fetch(`${BANKR}/agent/prompt`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });
    submitJson = await submit.json();
    if (!submit.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "bankr_submit_failed",
          status: submit.status,
          bankr: submitJson,
        },
        { status: 502 },
      );
    }
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: "bankr_unreachable",
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 502 },
    );
  }

  const jobId = submitJson.jobId || submitJson.id;
  if (!jobId) {
    return NextResponse.json(
      {
        ok: false,
        error: "bankr_no_job_id",
        bankr: submitJson,
      },
      { status: 502 },
    );
  }

  // (2) Poll
  const startedAt = Date.now();
  let lastJob: BankrJob = submitJson;
  while (Date.now() - startedAt < POLL_MAX_MS) {
    await sleep(POLL_INTERVAL_MS);
    try {
      const tick = await fetch(`${BANKR}/agent/job/${jobId}`, {
        headers: { "X-API-Key": apiKey, accept: "application/json" },
      });
      const tj: BankrJob = await tick.json();
      lastJob = tj;
      if (tj.status === "completed" || tj.status === "failed") break;
    } catch {
      // transient — keep polling
    }
  }

  // Stamp last-used
  await db
    .from("users")
    .update({ bankr_last_used_at: new Date().toISOString() })
    .eq("address", address);

  if (lastJob.status !== "completed") {
    return NextResponse.json({
      ok: false,
      status: lastJob.status,
      job_id: jobId,
      bankr: lastJob,
    });
  }

  return NextResponse.json({
    ok: true,
    status: "completed",
    job_id: jobId,
    result: lastJob.result ?? {},
    transactionHash: lastJob.result?.transactionHash ?? null,
    tokenSymbol: lastJob.result?.tokenSymbol ?? null,
    tokenAddress: lastJob.result?.tokenAddress ?? null,
    amountIn: lastJob.result?.amountIn ?? null,
    amountOut: lastJob.result?.amountOut ?? null,
  });
}
