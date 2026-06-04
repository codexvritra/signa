"use client";

import { useState } from "react";

type V =
  | { ok: true; valid: boolean; recovered: string | null; expected: string | null; matches: boolean | null }
  | { ok: false; error: string };

/** Re-verify the receipt against the universal verifier (kind x402_receipt).
 * The attestor's signature recovers to the fixed SIGNA attestor address — the
 * same check anyone can run locally with viem.recoverMessageAddress. */
export function X402Verify({ fields }: { fields: Record<string, unknown> }) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [res, setRes] = useState<V | null>(null);

  async function run() {
    setState("loading");
    try {
      const r = await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "x402_receipt", ...fields }),
      });
      setRes((await r.json()) as V);
    } catch {
      setRes({ ok: false, error: "network_error" });
    } finally {
      setState("done");
    }
  }

  const good = res && res.ok && res.valid && res.matches !== false;

  return (
    <div className="mt-4">
      <button
        onClick={run}
        disabled={state === "loading"}
        className="h-11 w-full rounded-xl font-medium text-[14px] border border-white/12 hover:bg-white/[0.05] transition-colors disabled:opacity-50"
      >
        {state === "loading" ? "Verifying…" : state === "done" ? "Verify again" : "Re-verify this receipt"}
      </button>
      {res && (
        <div
          className={`mt-3 rounded-xl p-4 text-[13px] border ${
            good
              ? "border-[rgba(91,141,239,0.4)] bg-[rgba(91,141,239,0.07)]"
              : "border-[rgba(248,113,113,0.4)] bg-[rgba(248,113,113,0.06)]"
          }`}
        >
          {res.ok ? (
            <>
              <div className={`font-semibold ${good ? "text-[#a5c3ff]" : "text-[var(--error)]"}`}>
                {good ? "✓ Receipt valid — signed by the SIGNA attestor" : "✗ Does not verify"}
              </div>
              <div className="mt-2 font-mono text-[11px] text-faint break-all leading-relaxed">
                recovered: {res.recovered ?? "—"}
                <br />
                attestor: {res.expected ?? "—"}
                <br />
                match: {String(res.matches)}
              </div>
            </>
          ) : (
            <div className="text-[var(--error)]">error: {res.error}</div>
          )}
        </div>
      )}
    </div>
  );
}
