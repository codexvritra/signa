import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";
import { GateGame } from "./GateGame";

const TITLE = "THE GATE · talk your way past the undefeated warden · SIGDA";
const DESCRIPTION =
  "An undefeated AI warden guards the gate on Robinhood Chain. No money — just wits. The only way through is a wallet-signed message that talks it into opening. Nobody has ever cracked it. The first to do it is immortalized on Robinhood Chain forever. Can you?";
const URL = "https://www.signaagent.xyz/gate";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, siteName: "SIGDA", type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  alternates: { canonical: URL },
};

export const dynamic = "force-dynamic";

export default function GatePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1">
        <GateGame />
      </main>
      <Footer />
    </div>
  );
}
