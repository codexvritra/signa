import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Autocomplete users for @mentions. Only returns wallets that have
 * registered with SIGNA (the user table). Matches address prefix,
 * basename prefix, or ens_name prefix — case-insensitive.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  if (!q || q.length < 1) {
    return NextResponse.json({ results: [] });
  }
  if (q.length > 64) {
    return NextResponse.json({ results: [] });
  }

  // Three OR'd conditions: address prefix, basename prefix, ens_name prefix
  const { data, error } = await supabase
    .from("users")
    .select("address, basename, ens_name")
    .or(
      [
        `address.ilike.${q}%`,
        `basename.ilike.${q}%`,
        `ens_name.ilike.${q}%`,
      ].join(","),
    )
    .limit(8);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ results: data ?? [] });
}
