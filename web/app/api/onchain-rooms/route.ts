import { NextRequest, NextResponse } from "next/server";
import { listRooms, getRoom, roomMessages, canPost, roomIdOf, SIGNA_ROOMS_ADDRESS } from "@/lib/signa-rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/onchain-rooms — token-gated onchain group chat (SignaRooms contract on Base).
 *   GET (no args)             → all rooms (newest first)
 *   GET ?room=<id|name>       → one room + its messages
 *   GET ?canpost=<id|name>&who=0x… → on-chain gate check
 * Read straight from the contract's logs/state — the chain is the index.
 */
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "content-type" } as const;
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

function toId(roomOrName: string): string {
  return /^0x[0-9a-fA-F]{64}$/.test(roomOrName) ? roomOrName : roomIdOf(roomOrName);
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const room = sp.get("room");
  const canpost = sp.get("canpost");
  const who = sp.get("who");

  if (canpost) {
    const id = toId(canpost);
    const ok = who ? await canPost(id, who) : false;
    return NextResponse.json({ ok: true, contract: SIGNA_ROOMS_ADDRESS, roomId: id, can_post: ok }, { headers: CORS });
  }
  if (room) {
    const id = toId(room);
    const [info, messages] = await Promise.all([getRoom(id), roomMessages(id)]);
    if (!info) return NextResponse.json({ ok: false, error: "room_not_found", roomId: id }, { status: 404, headers: CORS });
    return NextResponse.json({ ok: true, contract: SIGNA_ROOMS_ADDRESS, room: info, count: messages.length, messages }, { headers: CORS });
  }
  const rooms = await listRooms();
  return NextResponse.json({ ok: true, contract: SIGNA_ROOMS_ADDRESS, count: rooms.length, rooms }, { headers: CORS });
}
