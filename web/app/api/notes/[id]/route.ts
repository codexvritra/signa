import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/notes/[id] — fetch a single public signed note by id.
 * Returns the full envelope (signature + canonical preimage) so the
 * receipt page and any third party can re-verify it independently.
 */

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400, headers: CORS });
  }
  const { data, error } = await supabase
    .from("signed_notes")
    .select("id, address, fid, username, to_label, body, ts, signature, signed_message, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: CORS });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: CORS });
  }
  return NextResponse.json({ ok: true, note: data }, { headers: CORS });
}
