import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/pump/upload — store a token image in the public `pump` bucket, return its URL.
 * POST { data: "<base64>", contentType: "image/png" }  (max ~1.5 MB)
 */
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" } as const;
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const contentType = String(b.contentType ?? "");
  const ext = EXT[contentType];
  if (!ext) return NextResponse.json({ ok: false, error: "unsupported_type (png/jpg/gif/webp)" }, { status: 400, headers: CORS });
  let bytes: Buffer;
  try { bytes = Buffer.from(String(b.data ?? ""), "base64"); } catch { return NextResponse.json({ ok: false, error: "bad_base64" }, { status: 400, headers: CORS }); }
  if (bytes.length === 0 || bytes.length > 1_500_000) return NextResponse.json({ ok: false, error: "size 1..1.5MB" }, { status: 400, headers: CORS });

  const db = serverClient();
  const path = `tokens/${Date.now().toString(36)}-${Math.round(bytes.length).toString(36)}.${ext}`;
  const { error } = await db.storage.from("pump").upload(path, bytes, { contentType, upsert: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400, headers: CORS });
  const { data } = db.storage.from("pump").getPublicUrl(path);
  return NextResponse.json({ ok: true, url: data.publicUrl }, { headers: CORS });
}
