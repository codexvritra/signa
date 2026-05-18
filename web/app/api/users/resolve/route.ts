import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { mainnet, base } from "viem/chains";
import { normalize } from "viem/ens";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/users/resolve?handle=<0x | name.base.eth | name.eth>
 *
 * Single-source-of-truth resolver used by /dm/[handle] and /u/[handle]
 * (the public share-link surfaces). Returns:
 *
 *   { ok: true, address, basename, ens_name, on_signa: bool }
 *
 * Resolution order:
 *   1. If handle is 0x-prefixed 40-hex → lowercase it, look up in users
 *      table. address always returned even if not registered.
 *   2. If handle ends in .base.eth → ENSIP-19 reverse against Base via
 *      mainnet ENS resolver (Basenames). Then look up in users table.
 *   3. If handle ends in .eth → standard ENS resolve on Ethereum mainnet.
 *      Then look up in users table.
 *   4. Otherwise: try fuzzy match against users.basename / users.ens_name.
 *
 * `on_signa` is true iff the address has a row in the users table.
 */

const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETHEREUM_RPC_URL),
});

// Basenames live on Base but the L2Resolver is queried via mainnet.
// For now we just resolve .base.eth through mainnet too — Basenames
// expose forward records there.
const baseClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL),
});

function isHexAddress(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s);
}

async function lookupSigna(address: string): Promise<{
  basename: string | null;
  ens_name: string | null;
  on_signa: boolean;
}> {
  const { data } = await supabase
    .from("users")
    .select("basename, ens_name")
    .eq("address", address.toLowerCase())
    .maybeSingle();
  return {
    basename: data?.basename ?? null,
    ens_name: data?.ens_name ?? null,
    on_signa: !!data,
  };
}

export async function GET(req: NextRequest) {
  const rawHandle = (req.nextUrl.searchParams.get("handle") ?? "").trim();
  if (!rawHandle) {
    return NextResponse.json({ error: "missing_handle" }, { status: 400 });
  }
  if (rawHandle.length > 64) {
    return NextResponse.json({ error: "handle_too_long" }, { status: 400 });
  }

  const handle = rawHandle.toLowerCase();

  // 1. Direct 0x address.
  if (isHexAddress(handle)) {
    const meta = await lookupSigna(handle);
    return NextResponse.json({
      ok: true,
      handle,
      address: handle,
      ...meta,
      source: "address",
    });
  }

  // 2 + 3. ENS-shaped (includes .base.eth and .eth).
  if (handle.endsWith(".eth")) {
    let address: string | null = null;
    let normalized: string;
    try {
      normalized = normalize(handle);
    } catch {
      return NextResponse.json(
        { ok: false, error: "invalid_name" },
        { status: 400 },
      );
    }

    // First try users table (faster, and works for Basenames we've cached).
    const { data: viaDb } = await supabase
      .from("users")
      .select("address")
      .or(`basename.eq.${normalized},ens_name.eq.${normalized}`)
      .maybeSingle();
    if (viaDb?.address) {
      address = viaDb.address;
    }

    // Fallback to live ENS resolve.
    if (!address) {
      try {
        const client = handle.endsWith(".base.eth") ? baseClient : mainnetClient;
        const resolved = await client.getEnsAddress({ name: normalized });
        if (resolved) address = resolved.toLowerCase();
      } catch {
        // resolver miss — fall through
      }
    }

    if (!address) {
      return NextResponse.json(
        {
          ok: false,
          handle: rawHandle,
          error: "unresolvable",
          message:
            "couldn't resolve this name to a wallet via SIGNA, Basenames, or ENS",
        },
        { status: 404 },
      );
    }

    const meta = await lookupSigna(address);
    return NextResponse.json({
      ok: true,
      handle: rawHandle,
      address,
      ...meta,
      source: handle.endsWith(".base.eth") ? "basename" : "ens",
    });
  }

  // 4. Fuzzy match against users table.
  const { data: viaFuzzy } = await supabase
    .from("users")
    .select("address, basename, ens_name")
    .or(`basename.eq.${handle},ens_name.eq.${handle}`)
    .maybeSingle();
  if (viaFuzzy?.address) {
    return NextResponse.json({
      ok: true,
      handle: rawHandle,
      address: viaFuzzy.address,
      basename: viaFuzzy.basename,
      ens_name: viaFuzzy.ens_name,
      on_signa: true,
      source: "users_table",
    });
  }

  return NextResponse.json(
    {
      ok: false,
      handle: rawHandle,
      error: "unresolvable",
      message:
        "no SIGNA user, Basename, or ENS matches this handle. did you mean an address (0x…)?",
    },
    { status: 404 },
  );
}
