"use client";

import { useEffect, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { recoverMessageAddress } from "viem";

type Challenge = {
  ok: boolean;
  target: string;
  genuine: { message: string; signature: string };
  ledger: { attempts: number; forged: number };
};
type Result = { recovered: string | null; target: string; win: boolean; verdict: string } | null;

const short = (a?: string | null) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a ?? "");

export function ChallengeArena() {
  const [data, setData] = useState<Challenge | null>(null);
  const [localRecovered, setLocalRecovered] = useState<string | null>(null);
  const [text, setText] = useState("i am trying to forge the signa challenge wallet");
  const [pastedSig, setPastedSig] = useState("");
  const [pastedMsg, setPastedMsg] = useState("");
  const [result, setResult] = useState<Result>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  async function load() {
    try {
      const j = await (await fetch("/api/challenge", { cache: "no-store" })).json();
      if (j?.ok) setData(j);
    } catch { /* */ }
  }
  useEffect(() => { load(); }, []);

  async function verifyGenuineLocally() {
    if (!data) return;
    setBusy("verify");
    try {
      const r = await recoverMessageAddress({ message: data.genuine.message, signature: data.genuine.signature as `0x${string}` });
      setLocalRecovered(r.toLowerCase());
    } catch { setLocalRecovered("(failed)"); }
    finally { setBusy(null); }
  }

  async function submit(message: string, signature: string) {
    setBusy("submit"); setResult(null);
    try {
      const j = await (await fetch("/api/challenge/submit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message, signature, submitter: address }) })).json();
      if (j?.ok) setResult(j);
      else setResult({ recovered: null, target: data?.target ?? "", win: false, verdict: j?.error ?? "rejected" });
      load();
    } catch { setResult({ recovered: null, target: data?.target ?? "", win: false, verdict: "network error" }); }
    finally { setBusy(null); }
  }

  async function signAndSubmit() {
    if (!isConnected) return;
    setBusy("sign");
    try {
      const signature = await signMessageAsync({ message: text });
      await submit(text, signature);
    } catch { setBusy(null); }
  }

  const targetMatch = localRecovered && data && localRecovered === data.target;

  return (
    <div className="space-y-8">
      {/* ledger */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center">
          <div className="font-display text-4xl sm:text-5xl font-medium tabular-nums text-white">{data?.ledger.attempts ?? "—"}</div>
          <div className="text-[12px] uppercase tracking-[0.14em] text-white/45 mt-2">forgery attempts</div>
        </div>
        <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/[0.05] p-6 text-center">
          <div className="font-display text-4xl sm:text-5xl font-medium tabular-nums text-[var(--accent-text)]">{data?.ledger.forged ?? "—"}</div>
          <div className="text-[12px] uppercase tracking-[0.14em] text-white/45 mt-2">successful forgeries</div>
        </div>
      </div>

      {/* the genuine target + local verify */}
      <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.08] flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider text-white/40">the genuine signed message</span>
          <span className="text-[11px] font-mono text-white/40">target {short(data?.target)}</span>
        </div>
        <pre className="px-5 py-4 text-[12px] leading-[1.6] font-mono text-white/75 whitespace-pre-wrap break-words max-h-44 overflow-y-auto">{data?.genuine.message ?? "loading…"}</pre>
        <div className="px-5 py-3 border-t border-white/[0.08] flex flex-wrap items-center gap-3">
          <button onClick={verifyGenuineLocally} disabled={!data || busy !== null} className="text-[13px] font-mono border border-white/15 hover:border-white/30 rounded-full px-4 py-1.5 transition-colors disabled:opacity-50">
            {busy === "verify" ? "recovering…" : "recover signer in your browser"}
          </button>
          {localRecovered && (
            <span className={`text-[13px] font-mono ${targetMatch ? "text-[var(--accent-text)]" : "text-red-300"}`}>
              {targetMatch ? `✓ recovered ${short(localRecovered)} == target` : `recovered ${short(localRecovered)}`}
            </span>
          )}
        </div>
      </div>

      {/* attempt: sign your own with your wallet */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
        <div className="text-[14px] text-white font-medium mb-1">Try to forge it — sign any text with your wallet</div>
        <p className="text-[13px] text-white/55 leading-relaxed mb-4">Type anything, sign it, and watch it recover <span className="text-white">your</span> address — never the target. To win you would need a signature that recovers the target over text you chose.</p>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[13px] font-mono text-white/85 focus:border-white/30 outline-none resize-none mb-3" />
        <div className="flex flex-wrap items-center gap-3">
          {isConnected ? (
            <button onClick={signAndSubmit} disabled={busy !== null || !text.trim()} className="bg-[var(--accent)] text-white font-semibold rounded-full px-5 py-2.5 text-[14px] hover:brightness-110 transition disabled:opacity-50">
              {busy === "sign" || busy === "submit" ? "signing…" : "sign + submit"}
            </button>
          ) : (
            <ConnectButton.Custom>
              {({ openConnectModal, mounted }) => (
                <button onClick={openConnectModal} disabled={!mounted} className="bg-white text-black font-semibold rounded-full px-5 py-2.5 text-[14px] hover:bg-white/90 transition disabled:opacity-50">connect a wallet to try</button>
              )}
            </ConnectButton.Custom>
          )}
          <span className="text-[12px] text-white/35 font-mono">or paste a signature pair below</span>
        </div>
      </div>

      {/* advanced: paste a pair */}
      <details className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <summary className="text-[13px] text-white/65 cursor-pointer select-none">Advanced — paste a {`{ message, signature }`} to submit</summary>
        <div className="mt-4 space-y-3">
          <textarea value={pastedMsg} onChange={(e) => setPastedMsg(e.target.value)} rows={2} placeholder="message" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[12px] font-mono text-white/85 focus:border-white/30 outline-none resize-none" />
          <input value={pastedSig} onChange={(e) => setPastedSig(e.target.value)} placeholder="0x… signature" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[12px] font-mono text-white/85 focus:border-white/30 outline-none" />
          <button onClick={() => submit(pastedMsg, pastedSig)} disabled={busy !== null || !pastedMsg || !/^0x[0-9a-fA-F]+$/.test(pastedSig)} className="border border-white/15 hover:border-white/30 rounded-full px-4 py-1.5 text-[13px] transition-colors disabled:opacity-50">submit attempt</button>
        </div>
      </details>

      {/* verdict */}
      {result && (
        <div className={`rounded-2xl border p-5 ${result.win ? "border-[var(--accent)]/50 bg-[var(--accent)]/[0.08]" : "border-white/10 bg-white/[0.02]"}`}>
          <div className={`font-display text-[18px] font-medium mb-1 ${result.win ? "text-[var(--accent-text)]" : "text-white"}`}>
            {result.win ? "🏆 FORGED — you broke it" : "the signature holds"}
          </div>
          <div className="text-[13.5px] text-white/65 leading-relaxed">{result.verdict}</div>
          {result.recovered && <div className="text-[11px] font-mono text-white/35 mt-2">recovered {result.recovered} · target {result.target}</div>}
        </div>
      )}
    </div>
  );
}
