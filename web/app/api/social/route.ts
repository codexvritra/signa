import { NextRequest, NextResponse } from "next/server";
import { authorizeBearer } from "@/lib/secret-auth";
import { serverClient } from "@/lib/supabase";
import { generateTake, saveTake, listTakes } from "@/lib/social";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * /api/social — the SIGNA social agent's signed public takes.
 * GET  → recent takes (public feed)
 * POST → generate a new take (guarded by CRON_SECRET; body { topic? })
 */
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type, authorization" } as const;
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

export async function GET() {
  const takes = await listTakes(serverClient(), 30);
  return NextResponse.json({ ok: true, count: takes.length, takes }, { headers: CORS });
}

export async function POST(req: NextRequest) {
  if (!authorizeBearer(req, "CRON_SECRET")) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: CORS });
  const b = await req.json().catch(() => ({}));
  const take = await generateTake(req.nextUrl.origin, typeof b.topic === "string" ? b.topic : undefined);
  const id = await saveTake(serverClient(), take);
  return NextResponse.json({ ok: true, id, ...take }, { headers: CORS });
}
