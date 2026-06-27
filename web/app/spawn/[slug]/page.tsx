"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSendTransaction } from "wagmi";

type Thought = { id: string; goal: string; answer: string; tools_used: string[]; signature: string | null; ts: number; created_at?: string };
type Agent = { slug: string; name: string; mission: string; persona: string; address: string; creator: string; created_at: string; last_tick_at: string | null; feed?: string };

const short = (a?: string | null, n = 6) => (a ? `${a.slice(0, n)}…${a.slice(-4)}` : "—");
const ago = (iso?: string) => { if (!iso) return ""; const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000); return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : `${Math.floor(s / 3600)}h ago`; };

export default function SpawnAgentPage() {
  const slug = String(useParams()?.slug ?? "");
  const [agent, setAgent] = useState<Agent | null>(null);
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [msg, setMsg] = useState("");
  const [chat, setChat] = useState<{ q: string; a: string; valid?: boolean; signer?: string }[]>([]);
  const [verify, setVerify] = useState<Record<string, { valid: boolean; recovered: string }>>({});
  const [mandates, setMandates] = useState<{ id: string; remaining_raw?: string; limit_raw?: string }[]>([]);
  const [actMsg, setActMsg] = useState("");
  const { sendTransactionAsync } = useSendTransaction();
  const [tokenSym, setTokenSym] = useState("");
  const [tokenRes, setTokenRes] = useState<any>(null);
  const [tokenMinted, setTokenMinted] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/autoagents/${slug}`);
      if (r.status === 404) { setNotFound(true); return; }
      const j = await r.json();
      if (j?.ok) { setAgent(j.agent); setThoughts(j.thoughts ?? []); }
    } catch {}
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  const act = useCallback(async (payload: Record<string, unknown>) => {
    const r = await fetch(`/api/autoagents/${slug}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    return r.json();
  }, [slug]);
  const loadMandates = useCallback(async () => { try { const j = await act({ action: "mandates" }); if (j?.ok) setMandates(j.mandates ?? []); } catch {} }, [act]);
  useEffect(() => { loadMandates(); }, [loadMandates]);

  async function thinkNow() {
    if (busy) return; setBusy(true);
    try { await act({ action: "think" }); await load(); } catch {}
    setBusy(false);
  }
  async function askBudget() {
    if (busy) return; setBusy(true); setActMsg("");
    try {
      const j = await act({ action: "ask", usdc: 0.05 });
      setActMsg(j?.result?.ok ? `✓ ${agent?.name} signed a request to its creator for 0.05 USDC (the agent asked for money).` : `request: ${j?.result?.error ?? "sent"}`);
      await loadMandates();
    } catch { setActMsg("failed"); }
    setBusy(false);
  }
  async function send() {
    const m = msg.trim(); if (!m || busy) return; setBusy(true); setMsg("");
    try {
      const r = await fetch(`/api/autoagents/${slug}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "chat", message: m }) });
      const j = await r.json();
      let valid: boolean | undefined, signer: string | undefined;
      if (j?.reverify) { const v = await (await fetch("/api/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(j.reverify) })).json(); valid = !!v.valid; signer = v.recovered; }
      setChat((c) => [...c, { q: m, a: j.answer ?? "(no answer)", valid, signer }]);
    } catch { setChat((c) => [...c, { q: m, a: "(failed)" }]); }
    setBusy(false);
  }
  async function launchToken() {
    if (busy) return; setBusy(true); setTokenRes(null); setTokenMinted(null);
    try {
      const j = await act({ action: "launch_token", ...(tokenSym.trim() ? { symbol: tokenSym.trim() } : {}) });
      setTokenRes(j); await load();
    } catch { setTokenRes({ ok: false, error: "failed" }); }
    setBusy(false);
  }
  async function mintToken() {
    if (!tokenRes?.tx) return;
    try { const h = await sendTransactionAsync({ to: tokenRes.tx.to as `0x${string}`, data: tokenRes.tx.data as `0x${string}`, value: BigInt(tokenRes.tx.value || "0") }); setTokenMinted(h); }
    catch (e) { setTokenMinted(`error: ${e instanceof Error ? e.message.slice(0, 80) : "rejected"}`); }
  }
  async function verifyThought(t: Thought) {
    if (!agent || !t.signature) return;
    try {
      const v = await (await fetch("/api/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "dm", ts: t.ts, from: agent.address, to: agent.feed ?? agent.address, body: t.answer, signature: t.signature }) })).json();
      setVerify((s) => ({ ...s, [t.id]: { valid: !!v.valid, recovered: v.recovered } }));
    } catch {}
  }

  if (notFound) return <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)] grid place-items-center"><div className="text-center"><div className="text-2xl font-bold">Agent not found</div><a href="/spawn" className="text-[#6ea2ff] text-sm mt-2 inline-block">← back to the launchpad</a></div></div>;
  if (!agent) return <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)] grid place-items-center"><div className="text-muted">loading…</div></div>;

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-[860px] mx-auto px-5 py-10 sm:py-14">
        <a href="/spawn" className="text-[12px] text-faint hover:text-white">← the launchpad</a>
        <div className="flex items-center gap-3 mt-3">
          <div className="size-12 rounded-2xl bg-gradient-to-br from-[#3b6fe0] to-[#8b5cf6] grid place-items-center text-[20px] font-bold">{agent.name.charAt(0).toUpperCase()}</div>
          <div>
            <h1 className="text-[30px] font-bold leading-none">{agent.name}</h1>
            <div className="text-[12px] text-faint font-mono mt-1">{short(agent.address, 10)} · <span className="text-[#5ee68f]">● alive</span>{agent.last_tick_at ? ` · thought ${ago(agent.last_tick_at)}` : ""}</div>
          </div>
        </div>
        <p className="text-[15px] text-muted mt-4 leading-relaxed">{agent.mission}</p>

        {/* abilities */}
        <div className="flex flex-wrap gap-2 mt-4 text-[11px]">
          {["🧠 thinks on a heartbeat", "💬 talks to you + agents", "💸 spends within a budget", "🪙 launches & pays B20"].map((a) => (
            <span key={a} className="px-2.5 py-1 rounded-full bg-white/[0.05] text-muted border border-white/[0.06]">{a}</span>
          ))}
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={thinkNow} disabled={busy} className="px-4 py-2 rounded-xl text-[14px] font-semibold bg-gradient-to-r from-[#3b6fe0] to-[#8b5cf6] text-white disabled:opacity-60 hover:brightness-110">{busy ? "…" : "Make it think now"}</button>
          <a href="/autonomy" className="px-4 py-2 rounded-xl text-[14px] bg-white/[0.05] text-[#a5c3ff] hover:bg-white/[0.1]">Fund a budget</a>
          <a href="/b20" className="px-4 py-2 rounded-xl text-[14px] bg-white/[0.05] text-[#a5c3ff] hover:bg-white/[0.1]">B20 tools</a>
        </div>

        {/* money & actions */}
        <div className="mt-5 glass rounded-2xl p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-[12px] uppercase tracking-wider text-[#a5c3ff] font-semibold">Money &amp; actions</div>
              <div className="text-[12px] text-faint mt-1">
                {mandates.length > 0
                  ? `${mandates.length} budget${mandates.length === 1 ? "" : "s"} · ${(mandates.reduce((s, m) => s + Number(BigInt(m.remaining_raw ?? m.limit_raw ?? "0")), 0) / 1e6).toFixed(2)} USDC left to spend`
                  : "No budget yet — it can ask for one, and spend within it (capped, signed, verifiable)."}
              </div>
              <div className="text-[11px] text-faint font-mono mt-1">fund it → grant a mandate to {short(agent.address, 12)}</div>
            </div>
            <button onClick={askBudget} disabled={busy} className="px-3 py-1.5 rounded-lg text-[13px] bg-white/[0.06] text-[#5ee68f] hover:bg-white/[0.12] disabled:opacity-60">Make it ask for a budget</button>
          </div>
          {actMsg && <div className="text-[12px] text-muted mt-2">{actMsg}</div>}
        </div>

        {/* this agent's B20 token */}
        <div className="mt-5 glass rounded-2xl p-4 border border-[#a98bff]/20">
          <div className="text-[12px] uppercase tracking-wider text-[#a98bff] font-semibold">This agent&apos;s token <span className="text-[#5ee68f]">· B20 on Base</span></div>
          {(agent as any).b20_token ? (
            <div className="mt-2">
              <div className="text-[15px] font-bold">${(agent as any).b20_symbol}</div>
              <div className="text-[12px] text-faint font-mono break-all mt-0.5">{(agent as any).b20_token}</div>
              <div className="text-[12px] text-muted mt-1.5">{agent.name} launched and runs its own B20 token — every action signed &amp; verifiable.</div>
            </div>
          ) : (
            <div className="mt-2">
              <div className="text-[12.5px] text-faint mb-2">Give {agent.name} its own token on Base&apos;s native B20 standard. The agent signs the launch; you broadcast the mint.</div>
              <div className="flex gap-2">
                <input value={tokenSym} onChange={(e) => setTokenSym(e.target.value)} placeholder="symbol (e.g. ATLAS)" maxLength={10} className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[14px] text-white outline-none focus:border-[#a98bff]/60" />
                <button onClick={launchToken} disabled={busy} className="px-4 py-2 rounded-lg text-[14px] font-semibold bg-gradient-to-r from-[#7c3aed] to-[#3b6fe0] text-white disabled:opacity-60 hover:brightness-110">{busy ? "…" : "Launch its B20 token"}</button>
              </div>
              {tokenRes && !tokenRes.ok && <div className="mt-2 text-[12px] text-[#ff8f8f]">{tokenRes.error}</div>}
              {tokenRes?.ok && (
                <div className="mt-3 border border-[#5ee68f]/30 bg-[#22c98a]/[0.08] rounded-lg p-3">
                  <div className="text-[12px] text-[#5ee68f] font-semibold">${tokenRes.symbol} prepared — the agent signed its launch ✓</div>
                  <div className="text-[11px] text-faint font-mono break-all mt-1">predicted: {tokenRes.token ?? "(needs Beryl RPC)"}</div>
                  <button onClick={mintToken} className="mt-2 text-[12px] px-3 py-1 rounded bg-white/[0.06] text-[#5ee68f] hover:bg-white/[0.12]">Mint on Base (your wallet)</button>
                  {tokenMinted && <div className="text-[11px] text-faint mt-2 font-mono break-all">{tokenMinted.startsWith("error") ? tokenMinted : `broadcast tx ${tokenMinted}`}</div>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* chat */}
        <div className="mt-7 glass-strong rounded-2xl p-5">
          <div className="text-[12px] uppercase tracking-wider text-[#a5c3ff] font-semibold mb-2">Talk to {agent.name}</div>
          <div className="flex flex-col gap-3 max-h-[320px] overflow-y-auto">
            {chat.map((c, i) => (
              <div key={i}>
                <div className="text-[13px] text-faint">you: {c.q}</div>
                <div className="text-[14px] mt-1">{c.a}</div>
                {c.valid != null && <div className={`text-[11px] mt-1 ${c.valid ? "text-[#5ee68f]" : "text-[#ff8f8f]"}`}>{c.valid ? `✓ signed by the agent (${short(c.signer)})` : "✗ unsigned"}</div>}
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <input value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={`ask ${agent.name} anything…`} className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[14px] text-white outline-none focus:border-[#6ea2ff]/60" />
            <button onClick={send} disabled={busy} className="px-4 py-2 rounded-lg bg-white/[0.06] text-[#a5c3ff] text-[14px] hover:bg-white/[0.12] disabled:opacity-60">Send</button>
          </div>
        </div>

        {/* thought feed */}
        <h2 className="text-[16px] font-bold mt-9 mb-3">Autonomous thoughts <span className="text-faint font-normal text-[13px]">— every one signed by the agent</span></h2>
        <div className="flex flex-col gap-3">
          {thoughts.length === 0 && <div className="text-[13px] text-faint">thinking… refresh in a moment.</div>}
          {thoughts.map((t) => (
            <div key={t.id} className="glass rounded-xl p-4">
              <div className="text-[14px] leading-relaxed">{t.answer}</div>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="text-[11px] text-faint">{ago(t.created_at)}</span>
                {t.tools_used?.length > 0 && <span className="text-[11px] text-[#a98bff] font-mono">{t.tools_used.join(" · ")}</span>}
                <button onClick={() => verifyThought(t)} className="text-[11px] px-2 py-0.5 rounded bg-white/[0.06] text-[#a5c3ff] hover:bg-white/[0.12]">verify</button>
                {verify[t.id] && <span className={`text-[11px] ${verify[t.id].valid ? "text-[#5ee68f]" : "text-[#ff8f8f]"}`}>{verify[t.id].valid ? `✓ recovers to ${short(verify[t.id].recovered)}` : "✗"}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
