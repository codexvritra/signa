import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";
import { VerifyForm } from "./VerifyForm";

export const metadata = {
  title: "verify signature · signa",
  description:
    "Paste any EIP-191 signature + signed message + address, run the check in-browser. No server, no trust.",
};

/**
 * /verify — standalone in-browser EIP-191 signature verifier.
 *
 * Not specific to SIGNA-issued signatures — works for any personal_sign
 * output. Pure client-side viem.verifyMessage. Tool used by:
 *
 *   - users auditing a SIGNA reply they got from /respond or /i/[id]
 *   - third parties / partner ops verifying a SIGNA agent reply they
 *     received via webhook
 *   - anyone who wants to spot-check an arbitrary signature without
 *     trusting our database
 *
 * The point: SIGNA's signed-reply story is REAL. Anyone can paste the
 * sig, recover the address, and confirm. No backend dependency.
 */
export default function VerifyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 font-mono text-[13px] leading-[1.75] text-white/85">
        <div className="max-w-3xl mx-auto px-6 lg:px-10 pt-10 pb-14">
          <div className="flex items-baseline justify-between text-white/40 text-[11px] mb-8">
            <span>SIGNA-VERIFY(1)</span>
            <span className="hidden sm:inline">offline-capable</span>
          </div>

          <section className="mb-6">
            <h2 className="text-white tracking-[0.18em] text-[11px] mb-2">
              NAME
            </h2>
            <div className="pl-4 border-l border-white/[0.06]">
              signa-verify — eip-191 signature checker (client-side, no
              server round-trip)
            </div>
          </section>

          <section className="mb-6">
            <h2 className="text-white tracking-[0.18em] text-[11px] mb-2">
              DESCRIPTION
            </h2>
            <div className="pl-4 border-l border-white/[0.06] text-white/65">
              paste a wallet address, the exact signed message bytes, and
              the hex signature. runs{" "}
              <code className="text-white bg-white/[0.05] rounded px-1">
                viem.verifyMessage
              </code>{" "}
              in your browser — works for EOA (secp256k1) and ERC-1271
              (smart-account) signatures. signature recovery happens on
              your machine; signa servers see nothing.
            </div>
          </section>

          <VerifyForm />

          <section className="mt-10">
            <h2 className="text-white tracking-[0.18em] text-[11px] mb-2">
              SEE ALSO
            </h2>
            <div className="pl-4 border-l border-white/[0.06] text-white/55">
              every signa reply with{" "}
              <code className="text-white bg-white/[0.05] rounded px-1">
                signed:true
              </code>{" "}
              ships its preimage and sig in /api/interactions/[id]. paste
              them here to audit.
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
