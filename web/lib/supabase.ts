import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );
}

/**
 * Browser-safe Supabase client. Reads everything via RLS-allowed selects.
 * Never used for writes from the browser — writes go through Next.js API
 * routes which verify wallet signatures first.
 */
export const supabase: SupabaseClient = createClient(url, anon, {
  auth: { persistSession: false },
});

/**
 * Server-side client. Same anon key for now (v1 tradeoff: a determined
 * caller could write directly to Supabase REST and bypass our signature
 * verification — RLS only enforces shape constraints). To lock down, set
 * SUPABASE_SERVICE_ROLE_KEY in Vercel env and swap this factory to use it.
 */
export function serverClient(): SupabaseClient {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(url!, serviceRole || anon!, {
    auth: { persistSession: false },
  });
}
