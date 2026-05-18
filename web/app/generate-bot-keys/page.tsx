"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { toast } from "sonner";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";

type BotWallet = {
  kind: "MIROSHARK" | "GITLAWB" | "BANKR";
  basename: string;
  privateKey: string;
  address: string;
};

type Bundle = {
  bots: BotWallet[];
  mirosharkWebhookSecret: string;
};

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function mintOne(kind: BotWallet["kind"], basename: string): BotWallet {
  const pk = generatePrivateKey();
  const a = privateKeyToAccount(pk);
  return { kind, basename, privateKey: pk, address: a.address };
}

function mint(): Bundle {
  return {
    bots: [
      mintOne("MIROSHARK", "miroshark.bot.signa"),
      mintOne("GITLAWB", "gitlawb.bot.signa"),
      mintOne("BANKR", "bankr.bot.signa"),
    ],
    mirosharkWebhookSecret: randomHex(32),
  };
}

export default function GenerateBotKeysPage() {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Couldn't copy");
    }
  }

  function regenerate() {
    setBundle(mint());
    setCopied(null);
    toast.success("New bot bundle minted");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1">
        <section className="border-b border-white/[0.06]">
          <div className="max-w-3xl mx-auto px-6 lg:px-10 pt-12 pb-10">
            <Link
              href="/"
              className="text-xs text-white/45 hover:text-white inline-flex items-center gap-1 mb-8"
            >
              <ArrowLeft className="size-3" />
              Back
            </Link>
            <div className="text-xs uppercase tracking-wider text-white/40 mb-3">
              Setup utility · one-time
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-[-0.03em] leading-tight">
              Generate SIGNA bot wallets
            </h1>
            <p className="text-white/55 max-w-xl mt-4 text-[15px] leading-relaxed">
              Mints three wallets — one each for the MiroShark, gitlawb, and
              Bankr event-bridge bots — plus a HMAC secret for the MiroShark
              webhook receiver. Everything is generated locally in your
              browser. Paste the values into Vercel env, then the bridges go
              live on the next deploy.
            </p>
          </div>
        </section>

        <section className="border-b border-white/[0.06]">
          <div className="max-w-3xl mx-auto px-6 lg:px-10 py-10">
            {!bundle ? (
              <div className="flex flex-col items-start gap-4">
                <p className="text-sm text-white/65">
                  Click below to mint a fresh bundle. The values will appear
                  once. Copy them into your password manager + Vercel env
                  immediately — refreshing replaces them.
                </p>
                <button
                  onClick={() => setBundle(mint())}
                  className="bg-white text-black font-medium rounded-md px-4 py-2 text-sm hover:bg-white/90 transition-colors"
                >
                  Mint bot bundle
                </button>
              </div>
            ) : (
              <>
                <div className="rounded-md p-3 mb-5 flex items-start gap-2.5 border border-amber-300/20 bg-amber-300/[0.04]">
                  <AlertTriangle className="size-3.5 text-amber-300 mt-0.5 flex-shrink-0" />
                  <div className="text-[12px] text-amber-100/80 leading-relaxed">
                    <strong className="text-amber-200 font-semibold">
                      Save these now.
                    </strong>{" "}
                    Each private key is a bot&apos;s identity forever. Lose
                    it and the bot stops posting; leak it and anyone can
                    post as that bot.
                  </div>
                </div>

                <div className="space-y-5">
                  {bundle.bots.map((b) => (
                    <div key={b.kind}>
                      <div className="text-[11px] uppercase tracking-wider text-white/55 mb-2 font-medium">
                        {b.kind} bot · {b.basename}
                      </div>
                      <div className="space-y-3">
                        <Field
                          label={`${b.kind}_BOT_ADDRESS`}
                          value={b.address}
                          hint="The bot's public wallet — appears as the author of every signed post the bridge publishes."
                          copied={copied === `${b.kind}_BOT_ADDRESS`}
                          onCopy={() => copy(`${b.kind}_BOT_ADDRESS`, b.address)}
                        />
                        <Field
                          label={`${b.kind}_BOT_KEY`}
                          value={b.privateKey}
                          hint="Set as a Vercel env var. The bridge uses this to sign every post."
                          copied={copied === `${b.kind}_BOT_KEY`}
                          onCopy={() =>
                            copy(`${b.kind}_BOT_KEY`, b.privateKey)
                          }
                          masked
                        />
                      </div>
                    </div>
                  ))}

                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-white/55 mb-2 font-medium">
                      MiroShark webhook auth
                    </div>
                    <Field
                      label="MIROSHARK_WEBHOOK_SECRET"
                      value={bundle.mirosharkWebhookSecret}
                      hint="Set on Vercel AND on every MiroShark instance whose webhook points at SIGNA (as WEBHOOK_SECRET on the MiroShark side). Used for the X-MiroShark-Signature HMAC check."
                      copied={copied === "MIROSHARK_WEBHOOK_SECRET"}
                      onCopy={() =>
                        copy(
                          "MIROSHARK_WEBHOOK_SECRET",
                          bundle.mirosharkWebhookSecret,
                        )
                      }
                      masked
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    onClick={regenerate}
                    className="text-xs text-white/55 hover:text-white inline-flex items-center gap-1.5 px-3 py-1.5 border border-white/[0.1] rounded-md hover:bg-white/[0.04] transition-colors"
                  >
                    <RefreshCw className="size-3" />
                    Mint a different bundle
                  </button>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="border-b border-white/[0.06]">
          <div className="max-w-3xl mx-auto px-6 lg:px-10 py-10">
            <div className="text-xs uppercase tracking-wider text-white/40 mb-4">
              What to do next
            </div>
            <ol className="text-sm text-white/75 space-y-3 list-decimal pl-5">
              <li>Copy all 7 values into a password manager first.</li>
              <li>
                Open the SIGNA Vercel project → <strong>Settings → Environment Variables</strong>. Add:
                <ul className="mt-2 space-y-1 text-[13px] text-white/60 list-disc pl-5">
                  <li>
                    <code className="font-mono bg-white/[0.05] rounded px-1 py-0.5">
                      MIROSHARK_BOT_KEY
                    </code>
                  </li>
                  <li>
                    <code className="font-mono bg-white/[0.05] rounded px-1 py-0.5">
                      GITLAWB_BOT_KEY
                    </code>
                  </li>
                  <li>
                    <code className="font-mono bg-white/[0.05] rounded px-1 py-0.5">
                      BANKR_BOT_KEY
                    </code>
                  </li>
                  <li>
                    <code className="font-mono bg-white/[0.05] rounded px-1 py-0.5">
                      MIROSHARK_WEBHOOK_SECRET
                    </code>
                  </li>
                </ul>
              </li>
              <li>
                Redeploy. The bridges register the bots in the SIGNA users
                table on first post.
              </li>
              <li>
                For MiroShark operators: in their MiroShark env, set{" "}
                <code className="font-mono bg-white/[0.05] rounded px-1 py-0.5 text-[12px]">
                  WEBHOOK_GENERIC_URL=https://www.signaagent.xyz/api/webhooks/miroshark
                </code>{" "}
                and{" "}
                <code className="font-mono bg-white/[0.05] rounded px-1 py-0.5 text-[12px]">
                  WEBHOOK_SECRET=&lt;the secret above&gt;
                </code>
                . Every sim that finishes auto-publishes to /feed/miroshark.
              </li>
            </ol>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function Field({
  label,
  value,
  hint,
  copied,
  onCopy,
  masked = false,
}: {
  label: string;
  value: string;
  hint: string;
  copied: boolean;
  onCopy: () => void;
  masked?: boolean;
}) {
  const [revealed, setRevealed] = useState(!masked);
  return (
    <div className="card rounded-md p-3">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[10px] uppercase tracking-wider text-white/45 font-medium">
          {label}
        </label>
        <div className="flex items-center gap-1">
          {masked && (
            <button
              onClick={() => setRevealed((v) => !v)}
              className="text-[10px] text-white/55 hover:text-white px-2 py-1 rounded-sm transition-colors"
            >
              {revealed ? "Hide" : "Reveal"}
            </button>
          )}
          <button
            onClick={onCopy}
            className="text-[10px] text-white/55 hover:text-white px-2 py-1 rounded-sm inline-flex items-center gap-1 transition-colors"
          >
            {copied ? (
              <Check className="size-3 text-[var(--accent)]" />
            ) : (
              <Copy className="size-3" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <div className="font-mono text-[12px] text-white break-all leading-relaxed select-all">
        {revealed ? value : "•".repeat(Math.min(64, value.length))}
      </div>
      <div className="text-[11px] text-white/40 mt-1.5">{hint}</div>
    </div>
  );
}
