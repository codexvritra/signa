import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { verifySignedMessage } from "@/lib/verify-signature";
import { buildMessageToSign } from "@/lib/feed-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Toggle a like. Caller decides intent via `action: "like" | "unlike"`.
 * Both kinds are wallet-signed.
 */
export async function POST(req: NextRequest) {
  let body: {
    action?: "like" | "unlike";
    post_id?: string;
    address?: string;
    ts?: number;
    signature?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const action = body.action;
  const post_id = body.post_id ?? "";
  const ts = body.ts ?? 0;
  const signature = body.signature ?? "";
  const address = (body.address ?? "").toLowerCase();

  if (action !== "like" && action !== "unlike") {
    return NextResponse.json({ error: "bad action" }, { status: 400 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(post_id)) {
    return NextResponse.json({ error: "bad post_id" }, { status: 400 });
  }

  const message = buildMessageToSign({ kind: action, post_id, ts });
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
  if (action === "like") {
    const { error } = await db
      .from("likes")
      .upsert(
        { post_id, address: verify.address },
        { onConflict: "post_id,address" },
      );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await db
      .from("likes")
      .delete()
      .eq("post_id", post_id)
      .eq("address", verify.address);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
