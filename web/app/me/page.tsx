import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";
import { MeContent } from "./MeContent";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your crypto · SIGNA",
  description:
    "One tab for your crypto. Portfolio, watchlist, agents, DMs, social — all wallet-native.",
};

/**
 * /me — personal crypto command center.
 *
 * The wallet-native answer to LifeOS AI. Daily-driver surface that
 * shows everything personal to the connected wallet in one place:
 *   - Portfolio (live USD value, live prices via GeckoTerminal)
 *   - Watchlist (bookmarked tokens, client-side localStorage)
 *   - Launched agents (with their tokens, if any)
 *   - Recent DMs preview
 *   - Quick actions
 *
 * Server component shell + client content (MeContent) because portfolio
 * fetching depends on the connected wallet which is client-only state.
 */
export default function MePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1">
        <MeContent />
      </main>
      <Footer />
    </div>
  );
}
