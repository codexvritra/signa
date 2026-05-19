"use client";

import { useState } from "react";
import { verifyMessage } from "viem";

/**
 * Client-side EIP-191 verifier.
 *
 * Accepts:
 *   - 0x-prefixed wallet address (40 hex chars)
 *   - The exact signed message bytes (textarea — newlines matter)
 *   - 0x-prefixed signature (130 hex chars for EOA, longer for ERC-1271)
 *
 * No telemetry, no fetch. Pure in-browser cryptographic recovery.
 */
export function VerifyForm() {
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");
  const [signature, setSignature] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    | { kind: "ok" }
    | { kind: "bad" }
    | { kind: "error"; reason: string }
    | null
  >(null);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      if (!/^0x[a-fA-F0-9]{40}$/.test(address.trim())) {
        throw new Error("address must be 0x + 40 hex chars");
      }
      if (!signature.trim().startsWith("0x") || signature.trim().length < 100) {
        throw new Error("signature must be 0x-prefixed hex (≥100 chars)");
      }
      if (message.length === 0) {
        throw new Error("message is empty");
      }
      const ok = await verifyMessage({
        address: address.trim() as `0x${string}`,
        message,
        signature: signature.trim() as `0x${string}`,
      });
      setResult(ok ? { kind: "ok" } : { kind: "bad" });
    } catch (e) {
      setResult({
        kind: "error",
        reason: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-6">
      <h2 className="text-white tracking-[0.18em] text-[11px] mb-3">
        VERIFY
      </h2>

      <div className="pl-4 border-l border-white/[0.06] space-y-4">
        <Field label="address">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x…"
            spellCheck={false}
            className="w-full bg-transparent outline-none text-white placeholder:text-white/25 border-b border-white/15 focus:border-[var(--accent)] py-1"
          />
        </Field>

        <Field label="message">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            spellCheck={false}
            placeholder="exact bytes that were signed (newlines matter)"
            className="w-full bg-transparent outline-none text-white placeholder:text-white/25 border-l-2 border-white/15 focus:border-[var(--accent)] pl-3 py-1 resize-y"
          />
        </Field>

        <Field label="signature">
          <input
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="0x… (≥130 hex chars)"
            spellCheck={false}
            className="w-full bg-transparent outline-none text-white placeholder:text-white/25 border-b border-white/15 focus:border-[var(--accent)] py-1"
          />
        </Field>

        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={run}
            disabled={busy}
            className="text-[var(--accent)] hover:underline underline-offset-4 disabled:opacity-30"
          >
            {busy ? "[ verifying… ]" : "[ run check ]"}
          </button>
          {result?.kind === "ok" && (
            <span className="text-emerald-300">
              ✓ signature matches address
            </span>
          )}
          {result?.kind === "bad" && (
            <span className="text-red-300">
              ✗ signature does NOT match address
            </span>
          )}
          {result?.kind === "error" && (
            <span className="text-red-300">// {result.reason}</span>
          )}
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-white/40 mb-1">{label}</div>
      {children}
    </label>
  );
}
