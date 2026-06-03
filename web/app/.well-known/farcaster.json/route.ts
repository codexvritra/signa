import { NextResponse } from "next/server";
import { MINIAPP, HOME_EMBED_IMAGE, SITE } from "@/lib/miniapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /.well-known/farcaster.json
 *
 * The Mini App manifest. Identifies SIGNA as a Mini App at this domain so
 * Farcaster / Base App can deep-integrate (add to app, surface in search,
 * attribute casts).
 *
 * accountAssociation proves domain ownership and is signed by the project's
 * Farcaster custody key — it can't be generated server-side. Generate it once
 * with the Farcaster manifest tool (Warpcast → Settings → Developer → Domains,
 * or https://farcaster.xyz/~/developers/mini-apps/manifest) for the domain
 * www.signaagent.xyz, then set these env vars in Vercel:
 *   FARCASTER_HEADER, FARCASTER_PAYLOAD, FARCASTER_SIGNATURE
 * The embed cards render in-feed regardless; accountAssociation unlocks
 * publishing/attribution. Until set, we omit it (manifest stays valid JSON).
 */
export function GET() {
  const header = process.env.FARCASTER_HEADER;
  const payload = process.env.FARCASTER_PAYLOAD;
  const signature = process.env.FARCASTER_SIGNATURE;

  const manifest: Record<string, unknown> = {
    miniapp: {
      version: "1",
      name: MINIAPP.name,
      iconUrl: MINIAPP.iconUrl,
      homeUrl: MINIAPP.homeUrl,
      imageUrl: HOME_EMBED_IMAGE,
      buttonTitle: "Sign on Base",
      splashImageUrl: MINIAPP.splashImageUrl,
      splashBackgroundColor: MINIAPP.splashBackgroundColor,
      subtitle: "Wallet-signed messages on Base",
      description:
        "Sign a message on Base with one tap. No account, no key custody — your wallet signature is the proof, and anyone can re-verify who said it. The consumer face of the SIGNA message layer.",
      primaryCategory: "social",
      tags: ["base", "messaging", "signatures", "agents", "onchain"],
      heroImageUrl: HOME_EMBED_IMAGE,
      tagline: "Sign a message on Base",
      ogTitle: "SIGNA — sign a message on Base",
      ogDescription: "Wallet-signed, re-verifiable messages. One tap, no account.",
      ogImageUrl: HOME_EMBED_IMAGE,
      canonicalDomain: "www.signaagent.xyz",
      requiredChains: ["eip155:8453"],
      requiredCapabilities: [
        "wallet.getEthereumProvider",
        "actions.ready",
        "actions.composeCast",
      ],
    },
    baseBuilder: {
      // Base App reads the same manifest; this advertises the launch URL.
      allowedAddresses: [],
    },
  };

  if (header && payload && signature) {
    manifest.accountAssociation = { header, payload, signature };
  }

  return NextResponse.json(manifest, {
    headers: {
      "cache-control": "public, max-age=300",
      "content-type": "application/json",
      "access-control-allow-origin": "*",
    },
  });
}
