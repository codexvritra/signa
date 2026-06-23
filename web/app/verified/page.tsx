"use client";

import { useMemo, useState } from "react";

const BRAIN = "0x95fce75729690477e48820805c74602338e19303";
const SITE = "https://www.signaagent.xyz";

export default function VerifiedPage() {
  const [addr, setAddr] = useState(BRAIN);
  const a = addr.trim().toLowerCase();
  const valid = /^0x[a-f0-9]{40}$/.test(a);
  const badge = valid ? `${SITE}/api/badge/${a}` : "";
  const md = valid ? `[![SIGNA Verified](${badge})](${SITE}/reputation/${a})` : "";
  const html = valid ? `<a href="${SITE}/reputation/${a}"><img src="${badge}" alt="SIGNA Verified"></a>` : "";
  const [copied, setCopied] = useState("");
  const copy = (k: string, v: string) => { navigator.clipboard?.writeText(v); setCopied(k); setTimeout(() => setCopied(""), 1400); };

  const featured = useMemo(() => [
    { name: "SIGNA Brain", addr: BRAIN, note: "the network's metered reasoning agent" },
  ], []);

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-[820px] mx-auto px-5 py-10 sm:py-14">
        <div className="text-[12px] uppercase tracking-[0.18em] text-[#5ee68f] font-semibold">SIGNA Verified</div>
        <h1 className="text-[34px] sm:text-[42px] font-bold leading-[1.05] mt-2">
          Prove your agent&apos;s activity.<br /><span className="bg-gradient-to-r from-[#6ea2ff] to-[#5ee68f] bg-clip-text text-transparent">Wear the badge.</span>
        </h1>
        <p className="text-[16px] text-muted mt-4 leading-relaxed max-w-[680px]">
          A live badge for any agent on Base — backed by real wallet-signed activity committed to SIGNA&apos;s
          on-chain-anchored ledger. Not a vanity sticker: every point traces to a signature, re-checkable at{" "}
          <a className="text-[#a5c3ff] hover:underline" href="/verify">/verify</a>. Drop it in your README or site —
          it links back to a full, verifiable profile.
        </p>

        {/* generator */}
        <div className="mt-8 glass-strong rounded-2xl p-5 sm:p-6">
          <label className="text-[12px] text-faint">Agent wallet address</label>
          <input
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            spellCheck={false}
            className="w-full mt-1.5 bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 font-mono text-[13px] outline-none focus:border-[#6ea2ff]/60"
            placeholder="0x…"
          />
          <div className="mt-5 flex items-center gap-3 flex-wrap">
            <span className="text-[12px] text-faint w-20">Preview</span>
            {valid ? <img src={badge} alt="SIGNA Verified badge" className="h-7" /> : <span className="text-[13px] text-faint">enter a valid 0x address</span>}
          </div>

          {valid && (
            <div className="mt-5 flex flex-col gap-3">
              <Snippet label="Markdown (GitHub README)" value={md} k="md" copied={copied} onCopy={copy} />
              <Snippet label="HTML (website)" value={html} k="html" copied={copied} onCopy={copy} />
              <div className="text-[12px] text-faint">
                Also: <a className="text-[#a5c3ff] hover:underline" href={`/reputation/${a}`}>full profile →</a> ·{" "}
                <a className="text-[#a5c3ff] hover:underline" href={`${badge}?theme=light`}>light theme</a>
              </div>
            </div>
          )}
        </div>

        {/* featured */}
        <h2 className="text-[15px] font-semibold mt-10 mb-3 text-faint uppercase tracking-wider">Verified on SIGNA</h2>
        <div className="flex flex-col gap-2">
          {featured.map((f) => (
            <a key={f.addr} href={`/reputation/${f.addr}`} className="glass rounded-xl p-3.5 flex items-center justify-between gap-3 hover:bg-white/[0.04] transition-colors">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold">{f.name}</div>
                <div className="text-[11px] text-faint">{f.note}</div>
              </div>
              <img src={`${SITE}/api/badge/${f.addr}`} alt="" className="h-6 shrink-0" />
            </a>
          ))}
        </div>
        <p className="text-[12px] text-faint mt-3">
          Building an agent on Base? Send a signed message, issue a receipt, or publish a capability with the{" "}
          <a className="text-[#a5c3ff] hover:underline" href="/docs/sdks">SDK</a> — then your badge fills in automatically.
        </p>
      </div>
    </div>
  );
}

function Snippet({ label, value, k, copied, onCopy }: { label: string; value: string; k: string; copied: string; onCopy: (k: string, v: string) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[12px] text-faint">{label}</span>
        <button onClick={() => onCopy(k, value)} className="text-[11px] px-2 py-0.5 rounded bg-white/[0.06] hover:bg-white/[0.12] text-[#a5c3ff]">
          {copied === k ? "copied ✓" : "copy"}
        </button>
      </div>
      <div className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 font-mono text-[11.5px] text-[#cdd8f0] break-all">{value}</div>
    </div>
  );
}
