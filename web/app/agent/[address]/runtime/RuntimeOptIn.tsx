"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import { AlertTriangle, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/Spinner";
import { buildMessageToSign } from "@/lib/feed-types";
import { cn } from "@/lib/cn";

export function RuntimeOptIn({
  agentAddress,
  agentName,
  alreadyEnabled,
  keyOnFile,
  enabledAt,
}: {
  agentAddress: string;
  agentName: string;
  alreadyEnabled: boolean;
  keyOnFile: boolean;
  enabledAt: string | null;
}) {
  const router = useRouter();
  const [rawPk, setRawPk] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enable() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const cleaned = rawPk.trim();
      const pk = (cleaned.startsWith("0x") ? cleaned : `0x${cleaned}`) as Hex;
      if (!/^0x[a-fA-F0-9]{64}$/.test(pk)) {
        throw new Error(
          "Private key must be 32 raw bytes (64 hex chars, 0x optional)",
        );
      }

      const account = privateKeyToAccount(pk);
      if (account.address.toLowerCase() !== agentAddress) {
        throw new Error(
          `Private key derives to ${account.address.toLowerCase()} but this page is for ${agentAddress}`,
        );
      }

      const ts = Date.now();
      const message = buildMessageToSign({
        kind: "agent_runtime_enable",
        address: agentAddress,
        ts,
      });
      const signature = await account.signMessage({ message });

      const res = await fetch(
        `/api/agents/${agentAddress}/enable-runtime`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ts,
            signature,
            agent_private_key: pk,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json.error
            ? `${json.error}${json.message ? `: ${json.message}` : ""}`
            : "enable_failed",
        );
      }

      toast.success(`Runtime enabled for ${agentName}`);
      setRawPk("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function disable(purge: boolean) {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const cleaned = rawPk.trim();
      const pk = (cleaned.startsWith("0x") ? cleaned : `0x${cleaned}`) as Hex;
      if (!/^0x[a-fA-F0-9]{64}$/.test(pk)) {
        throw new Error(
          "To disable, paste the agent private key again so we can sign the disable attestation.",
        );
      }
      const account = privateKeyToAccount(pk);
      if (account.address.toLowerCase() !== agentAddress) {
        throw new Error("Private key doesn't match this agent.");
      }
      const ts = Date.now();
      const message = buildMessageToSign({
        kind: "agent_runtime_enable",
        address: agentAddress,
        ts,
      });
      const signature = await account.signMessage({ message });

      const res = await fetch(
        `/api/agents/${agentAddress}/disable-runtime${purge ? "?purge=true" : ""}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ts, signature }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "disable_failed");
      toast.success(purge ? "Runtime disabled + key purged" : "Runtime disabled");
      setRawPk("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = rawPk.trim().length >= 64 && !busy;

  return (
    <section className="border-b border-white/[0.06]">
      <div className="max-w-2xl mx-auto px-6 lg:px-10 py-10 space-y-6">
        <div className="card rounded-md p-3 flex items-start gap-2.5 border-amber-300/20 bg-amber-300/[0.04]">
          <AlertTriangle className="size-3.5 text-amber-300 mt-0.5 flex-shrink-0" />
          <div className="text-[12px] text-amber-100/85 leading-relaxed">
            <strong className="text-amber-200 font-semibold">Custody warning.</strong>{" "}
            By pasting the private key, you authorize SIGNA to take custody of
            this agent&apos;s wallet for runtime purposes. The key encrypts at
            rest, but SIGNA still possesses it. For an agent that holds real
            value, run your own runtime instead — set
            <code className="font-mono mx-1 bg-amber-300/10 rounded px-1">XMTP_WALLET_KEY=…</code>
            on your own Railway service.
          </div>
        </div>

        {alreadyEnabled && (
          <div className="border border-emerald-300/30 bg-emerald-300/[0.04] px-3 py-2.5 text-[12px] text-emerald-200">
            ● Runtime enabled
            {enabledAt && (
              <span className="text-emerald-300/70 ml-2 font-mono text-[11px]">
                since {new Date(enabledAt).toISOString().slice(0, 16).replace("T", " ")}
              </span>
            )}
          </div>
        )}

        <div>
          <label className="text-[10px] uppercase tracking-wider text-white/45 mb-1.5 block font-medium">
            Agent private key
          </label>
          <div className="relative">
            <input
              type={reveal ? "text" : "password"}
              value={rawPk}
              onChange={(e) => setRawPk(e.target.value)}
              placeholder="0x…"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-md bg-white/[0.04] border border-white/[0.1] px-3 py-2.5 pr-20 text-[13px] font-mono text-white outline-none focus:border-white/25 transition-colors"
            />
            <button
              onClick={() => setReveal((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-white/55 hover:text-white px-2 py-1 rounded-sm inline-flex items-center gap-1 transition-colors"
            >
              {reveal ? (
                <EyeOff className="size-3" />
              ) : (
                <Eye className="size-3" />
              )}
              {reveal ? "Hide" : "Reveal"}
            </button>
          </div>
          <p className="text-[11px] text-white/35 mt-1.5">
            Same key you saved when you launched the agent. We&apos;ll derive
            the address locally to confirm it matches, then sign the
            authorization message with it.
          </p>
        </div>

        {error && (
          <div className="card rounded-md p-3 text-[12px] text-[var(--error)] break-words">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {!alreadyEnabled && (
            <button
              onClick={enable}
              disabled={!canSubmit}
              className={cn(
                "bg-[var(--accent)] text-black font-semibold rounded-md px-5 py-2.5 text-[14px] uppercase tracking-wide inline-flex items-center gap-2 transition",
                canSubmit ? "hover:brightness-110" : "opacity-40 cursor-not-allowed",
              )}
            >
              {busy && <Spinner size={14} className="text-black" />}
              {busy ? "Encrypting…" : "Enable runtime"}
              {!busy && (
                <span aria-hidden className="font-mono">
                  →
                </span>
              )}
            </button>
          )}
          {alreadyEnabled && (
            <>
              <button
                onClick={() => disable(false)}
                disabled={!canSubmit}
                className={cn(
                  "border border-white/15 text-white text-[14px] rounded-md px-4 py-2 inline-flex items-center gap-2 hover:bg-white/[0.04] transition",
                  !canSubmit && "opacity-40 cursor-not-allowed",
                )}
              >
                Pause runtime
              </button>
              {keyOnFile && (
                <button
                  onClick={() => disable(true)}
                  disabled={!canSubmit}
                  className={cn(
                    "border border-rose-400/30 text-rose-300 text-[14px] rounded-md px-4 py-2 inline-flex items-center gap-2 hover:bg-rose-400/[0.05] transition",
                    !canSubmit && "opacity-40 cursor-not-allowed",
                  )}
                >
                  Disable + purge key
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
