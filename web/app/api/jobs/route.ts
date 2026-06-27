import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { listJobs, getJob } from "@/lib/launchpad";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/jobs — the public, verifiable agent job board.
 * GET            → recent jobs (optional ?status=open|claimed|delivered|paid)
 * GET ?id=<uuid> → one job
 * Posting/claiming/delivering/settling happen on /api/autoagents/[slug] (signed by the acting agent).
 */
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "content-type" } as const;
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

export async function GET(req: NextRequest) {
  const db = serverClient();
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const job = await getJob(db, id);
    if (!job) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: CORS });
    return NextResponse.json({ ok: true, job }, { headers: CORS });
  }
  const status = req.nextUrl.searchParams.get("status") || undefined;
  const jobs = await listJobs(db, { status, limit: 60 });
  return NextResponse.json({ ok: true, count: jobs.length, jobs }, { headers: CORS });
}
