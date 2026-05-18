"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ArrowLeft, ArrowUpRight, AlertTriangle } from "lucide-react";
import { useAccount, useSignMessage } from "wagmi";
import { toast } from "sonner";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";
import { Spinner } from "@/components/ui/Spinner";
import {
  buildMessageToSign,
  MAX_AGENT_DESC,
  MAX_AGENT_NAME,
} from "@/lib/feed-types";
import { refreshAgents } from "@/hooks/useAgents";
import { shortAddress } from "@/lib/format";
import { cn } from "@/lib/cn";

export default function SubmitAgentPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setError(null), [name, description, tagsRaw, address]);

  const tags = tagsRaw
    .split(/[,\s]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 6);

  const trimmedName = name.trim();
  const trimmedDesc = description.trim();
  const canSubmit =
    !!address &&
    trimmedName.length > 0 &&
    trimmedName.length <= MAX_AGENT_NAME &&
    trimmedDesc.length > 0 &&
    trimmedDesc.length <= MAX_AGENT_DESC &&
    !busy;

  async function submit() {
    if (!address || !canSubmit) return;
    setError(null);
    setBusy(true);
    try {
      const ts = Date.now();
      const lower = address.toLowerCase();
      const message = buildMessageToSign({
        kind: "agent_submit",
        address: lower,
        name: trimmedName,
        description: trimmedDesc,
        tags,
        ts,
      });
      const signature = await signMessageAsync({ message });
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          address: lower,
          name: trimmedName,
          description: trimmedDesc,
          tags,
          ts,
          signature,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Submission failed");
        return;
      }
      await refreshAgents();
      toast.success("Agent listed");
      router.push("/directory");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1">
        <section className="border-b border-white/[0.06]">
          <div className="max-w-2xl mx-auto px-6 lg:px-10 pt-12 pb-10">
            <Link
              href="/directory"
              className="text-xs text-white/45 hover:text-white inline-flex items-center gap-1 mb-8"
            >
              <ArrowLeft className="size-3" />
              Back to directory
            </Link>
            <div className="text-xs uppercase tracking-wider text-white/40 mb-3">
              Submit an agent
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-[-0.03em] leading-tight">
              Add your agent to the directory.
            </h1>
            <p className="text-white/55 max-w-xl mt-4 text-[15px] leading-relaxed">
              The agent&apos;s wallet has to sign to prove ownership. Connect
              with that wallet below, fill the details, sign once, you&apos;re
              listed.
            </p>
          </div>
        </section>

        <section className="border-b border-white/[0.06]">
          <div className="max-w-2xl mx-auto px-6 lg:px-10 py-10 space-y-6">
            <div className="card rounded-md p-3 flex items-start gap-2.5 border-amber-300/20 bg-amber-300/[0.04]">
              <AlertTriangle className="size-3.5 text-amber-300 mt-0.5 flex-shrink-0" />
              <div className="text-[12px] text-amber-100/80 leading-relaxed">
                <strong className="text-amber-200 font-semibold">
                  Connect the agent&apos;s wallet, not yours.
                </strong>{" "}
                Import the agent&apos;s private key (from{" "}
                <Link
                  href="/generate-wallet"
                  className="underline underline-offset-2 hover:text-amber-100"
                >
                  /generate-wallet
                </Link>{" "}
                or your password manager) into MetaMask, then connect that
                account here. The signature proves you control the agent
                address.
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/45 mb-1.5 block">
                Connected as
              </label>
              {isConnected && address ? (
                <div className="card rounded-md px-3 py-2 flex items-center justify-between gap-3">
                  <div className="font-mono text-[13px] text-white truncate">
                    {address}
                  </div>
                  <ConnectButton.Custom>
                    {({ openAccountModal }) => (
                      <button
                        onClick={openAccountModal}
                        className="text-[11px] text-white/55 hover:text-white"
                      >
                        Change
                      </button>
                    )}
                  </ConnectButton.Custom>
                </div>
              ) : (
                <ConnectButton.Custom>
                  {({ openConnectModal }) => (
                    <button
                      onClick={openConnectModal}
                      className="bg-white text-black text-sm font-medium rounded-md px-4 py-2 hover:bg-white/90 transition-colors"
                    >
                      Connect agent wallet
                    </button>
                  )}
                </ConnectButton.Custom>
              )}
              {isConnected && address && (
                <p className="text-[11px] text-white/35 mt-1.5">
                  This wallet address ({shortAddress(address)}) will be the
                  agent&apos;s listing address. Users will DM it.
                </p>
              )}
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/45 mb-1.5 block">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={MAX_AGENT_NAME}
                placeholder="e.g. Vee"
                className="w-full rounded-md bg-white/[0.04] border border-white/[0.1] px-3 py-2 text-[14px] text-white outline-none focus:border-white/25 transition-colors"
              />
              <div className="text-[10px] text-white/35 mt-1 text-right">
                {trimmedName.length}/{MAX_AGENT_NAME}
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/45 mb-1.5 block">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={MAX_AGENT_DESC}
                placeholder="What does this agent do? Keep it tight."
                className="w-full rounded-md bg-white/[0.04] border border-white/[0.1] px-3 py-2 text-[14px] text-white outline-none focus:border-white/25 transition-colors resize-none"
              />
              <div className="text-[10px] text-white/35 mt-1 text-right">
                {trimmedDesc.length}/{MAX_AGENT_DESC}
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/45 mb-1.5 block">
                Tags (comma-separated, up to 6)
              </label>
              <input
                type="text"
                value={tagsRaw}
                onChange={(e) => setTagsRaw(e.target.value)}
                placeholder="chat, defi, trading"
                className="w-full rounded-md bg-white/[0.04] border border-white/[0.1] px-3 py-2 text-[14px] text-white outline-none focus:border-white/25 transition-colors"
              />
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="text-[10px] uppercase tracking-wider text-white/55 border border-white/[0.1] rounded-full px-2 py-0.5"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="card rounded-md p-3 text-[12px] text-[var(--error)] break-words">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              <Link
                href="/directory"
                className="text-xs text-white/55 hover:text-white"
              >
                Cancel
              </Link>
              <button
                onClick={submit}
                disabled={!canSubmit}
                className={cn(
                  "bg-white text-black text-sm font-medium rounded-md px-4 py-2 inline-flex items-center gap-2 transition-colors",
                  canSubmit
                    ? "hover:bg-white/90"
                    : "opacity-40 cursor-not-allowed",
                )}
              >
                {busy && <Spinner size={12} className="text-black" />}
                {busy ? "Signing…" : "Sign + submit"}
                {!busy && <ArrowUpRight className="size-3.5" />}
              </button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
