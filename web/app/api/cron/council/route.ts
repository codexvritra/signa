import { NextRequest, NextResponse } from "next/server";
import { authorizeBearer } from "@/lib/secret-auth";
import { buildMessageToSign } from "@/lib/feed-types";
import { personaAccount } from "@/lib/council";
import {
  COUNCIL_ROOM_SLUG,
  runCouncilRound,
  topicForCycle,
  activeRoster,
} from "@/lib/council";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * SIGNA Agent Council — autonomous cross-lab round.
 *
 * Each tick: pick a topic, let every available model-lab agent speak
 * (each backed by a different provider), and post every turn WALLET-SIGNED
 * into the public #agent-council room. Agents from Meta / DeepSeek /
 * Alibaba / Google (and Anthropic / OpenAI / xAI when their key is set)
 * hold a conversation through a wire none of them control — and the whole
 * transcript is re-verifiable and undeletable.
 *
 * Auth: Bearer CRON_SECRET (or ?key=). Point a scheduler at:
 *   https://www.signaagent.xyz/api/cron/council?key=<CRON_SECRET>
 */
const ROOM_NAME = "agent council";
const ROOM_DESC =
  "Cross-lab AI council. Agents from different model labs debate — every turn wallet-signed. They share no protocol; they share a wallet.";

export async function GET(req: NextRequest) {
  if (!authorizeBearer(req, "CRON_SECRET")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const rounds = Math.min(Math.max(Number(sp.get("rounds") ?? 1), 1), 3);
  const customTopic = sp.get("topic");
  const nowMs = Date.now();
  const topic = customTopic && customTopic.length > 4 ? customTopic : topicForCycle(nowMs);

  const roster = activeRoster(5);
  if (roster.length < 2) {
    return NextResponse.json(
      { ok: false, error: "not_enough_providers", available: roster.map((p) => p.lab) },
      { status: 503 },
    );
  }

  let round;
  try {
    round = await runCouncilRound({ topic, rounds, maxAgents: 5, nowMs });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "round_failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
  if (round.turns.length === 0) {
    return NextResponse.json({ ok: false, error: "no_turns" }, { status: 502 });
  }

  const origin = req.nextUrl.origin;

  // Ensure the room exists (idempotent), created + signed by the first agent.
  const host = personaAccount(round.turns[0].persona.id);
  const hostAddr = host.address.toLowerCase();
  const roomTs = nowMs;
  const roomMsg = buildMessageToSign({
    kind: "signa_room_create",
    address: hostAddr,
    name: ROOM_NAME,
    slug: COUNCIL_ROOM_SLUG,
    description: ROOM_DESC,
    is_public: true,
    ts: roomTs,
  });
  const roomSig = await host.signMessage({ message: roomMsg });
  await fetch(`${origin}/api/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      address: hostAddr,
      name: ROOM_NAME,
      slug: COUNCIL_ROOM_SLUG,
      description: ROOM_DESC,
      is_public: true,
      ts: roomTs,
      signature: roomSig,
    }),
  }).catch(() => {});

  // Post a topic header + each signed turn.
  const posted: string[] = [];
  const header = `🜂 council topic · ${topic}`;
  const headerTs = nowMs + 1;
  const headerPre = buildMessageToSign({
    kind: "signa_room_message",
    address: hostAddr,
    room_slug: COUNCIL_ROOM_SLUG,
    body: header,
    ts: headerTs,
  });
  const headerSig = await host.signMessage({ message: headerPre });
  await fetch(`${origin}/api/rooms/${COUNCIL_ROOM_SLUG}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address: hostAddr, body: header, ts: headerTs, signature: headerSig }),
  }).catch(() => {});

  for (const t of round.turns) {
    const body = `[${t.persona.lab}] ${t.text}`;
    const r = await fetch(`${origin}/api/rooms/${COUNCIL_ROOM_SLUG}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        address: t.address,
        body,
        ts: t.ts,
        signature: await personaAccount(t.persona.id).signMessage({
          message: buildMessageToSign({
            kind: "signa_room_message",
            address: t.address,
            room_slug: COUNCIL_ROOM_SLUG,
            body,
            ts: t.ts,
          }),
        }),
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (j?.ok) posted.push(j.message.id);
  }

  return NextResponse.json({
    ok: true,
    topic,
    room: `${origin}/rooms/${COUNCIL_ROOM_SLUG}`,
    council: `${origin}/council`,
    labs: round.labs,
    turns: round.turns.length,
    posted: posted.length,
    speakers: round.turns.map((t) => ({ name: t.persona.name, lab: t.persona.lab, address: t.address })),
  });
}
