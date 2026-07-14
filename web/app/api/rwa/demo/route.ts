import { NextRequest, NextResponse } from "next/server";
import { attestStock, findStock, findImpostors, reReadSupply, RWA_ATTESTOR_ADDRESS } from "@/lib/rwa";
import { verifyArtifact } from "@/lib/verify-artifact";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/rwa/demo — the whole proof, live, in one call.
 *
 *   1. read the canonical Robinhood Stock Token's state from Robinhood Chain
 *   2. the SIGNA RWA attestor signs "this contract is the real <TICKER>, supply S at block N"
 *   3. leg 1 — the signature re-verifies through the universal verifier (it's SIGNA's attestor)
 *   4. leg 2 — replay the eth_call at block N independently: the supply still matches
 *   5. show the ticker squatters SIGNA's vouch distinguishes it from
 *
 * Nothing here is mocked: real chain reads, a real signature, real impostors.
 */
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "content-type" } as const;
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

export async function GET(req: NextRequest) {
  const ticker = (req.nextUrl.searchParams.get("ticker") ?? "NVDA").toUpperCase();
  const token = findStock(ticker) ?? findStock("NVDA")!;

  try {
    // 1–2) read live onchain state + sign it
    const attestation = await attestStock(token);

    // 3) leg 1 — signature recovers to the SIGNA RWA attestor
    // `kind` last: the artifact discriminator must win over any field on the attestation.
    const reverify = await verifyArtifact({ ...attestation, kind: "rwa_attestation" });

    // 4) leg 2 — independent onchain replay at the pinned block
    const replay = await reReadSupply(attestation.contract, attestation.block);
    const supply_matches = replay.ok && replay.supply === attestation.supply;

    // 5) the squatters this vouch protects against
    const impostors = await findImpostors(token.ticker, token.address);

    const ok = reverify.ok && (reverify as any).valid === true && (reverify as any).matches === true && supply_matches;

    return NextResponse.json(
      {
        ok,
        headline: ok
          ? `SIGNA attested the real ${token.ticker} on Robinhood Chain — signature + onchain state both re-verify`
          : "attestation could not be fully verified",
        subject: `${token.company} (${token.ticker})`,
        canonical_contract: attestation.contract,
        attestor: RWA_ATTESTOR_ADDRESS,
        steps: [
          { step: "read", ok: true, detail: `totalSupply ${attestation.supply_display} ${token.ticker} at block ${attestation.block}` },
          { step: "sign", ok: !!attestation.signature, detail: `signed by the SIGNA RWA attestor ${RWA_ATTESTOR_ADDRESS}` },
          { step: "verify-signature", ok: (reverify as any).valid === true && (reverify as any).matches === true, detail: "recovers to the attestor via the universal verifier" },
          { step: "replay-onchain", ok: supply_matches, detail: supply_matches ? `re-read at block ${attestation.block}: supply identical` : "onchain replay did not match (node may not serve that block's state)" },
        ],
        attestation,
        reverify,
        onchain_replay: { block: attestation.block, attested_supply: attestation.supply, replayed_supply: replay.supply, matches: supply_matches },
        impostors: { count: impostors.length, note: `contracts squatting the ${token.ticker} ticker on Robinhood Chain — SIGNA's signature names the real one`, items: impostors },
      },
      { headers: CORS },
    );
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "demo_failed" }, { status: 502, headers: CORS });
  }
}
