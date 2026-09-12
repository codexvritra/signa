import type { Metadata } from "next";
import { MiniApp } from "./MiniApp";
import { HOME_EMBED_IMAGE, MINIAPP, miniAppEmbedMeta } from "@/lib/miniapp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign a message on Robinhood Chain",
  description:
    "One tap, no account. Sign a message on Robinhood Chain with your wallet — re-verifiable by anyone. The SIGDA message layer, made simple.",
  openGraph: {
    title: "SIGDA — sign a message on Robinhood Chain",
    description: "Wallet-signed, re-verifiable messages. One tap, no account.",
    url: MINIAPP.homeUrl,
    images: [{ url: HOME_EMBED_IMAGE, width: 1200, height: 800 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SIGDA — sign a message on Robinhood Chain",
    description: "Wallet-signed, re-verifiable messages. One tap, no account.",
    images: [HOME_EMBED_IMAGE],
  },
  // The Mini App embed: makes this URL render as an interactive card in-feed.
  other: miniAppEmbedMeta(HOME_EMBED_IMAGE, MINIAPP.homeUrl, "Sign on Robinhood Chain"),
};

export default function MiniPage() {
  return <MiniApp />;
}
