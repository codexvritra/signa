import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";
import { EcosystemFeed } from "@/components/feed/EcosystemFeed";
import { getBotAddress } from "@/lib/signa-bots";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "MiroShark on SIGNA — live sim verdicts",
  description:
    "Every MiroShark sim completion auto-publishes here. Wallet-signed posts from miroshark.bot.signa.",
};

export default function MirosharkFeedPage() {
  const botAddress = getBotAddress("miroshark");
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1">
        <EcosystemFeed
          kind="miroshark"
          projectName="MiroShark"
          projectUrl="https://github.com/aaronjmars/MiroShark"
          holdersHref="/holders/MIROSHARK"
          botAddress={botAddress}
          emoji="🦈"
          tagline="Live swarm-simulation verdicts on a public, wallet-signed timeline. Every MiroShark sim that finishes auto-publishes here with its bullish/neutral/bearish split and a watch link."
          sourceLine="MiroShark generic webhook (HMAC-verified) → SIGNA feed via miroshark.bot.signa"
          setupHint="The MIROSHARK_BOT_KEY env var isn't set on this deployment yet. Visit /generate-bot-keys to mint a bundle and paste them into Vercel env. Once deployed, MiroShark operators point their WEBHOOK_GENERIC_URL at /api/webhooks/miroshark with the shared secret."
        />
      </main>
      <Footer />
    </div>
  );
}
