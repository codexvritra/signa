"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

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

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/autoagents/${slug}`);
      if (r.status === 404) { setNotFound(true); return; }
      const j = await r.json();
      if (j?.ok) { setAgent(j.agent); setThoughts(j.thoughts ?? []); }
    } catch {}
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  async function thinkNow() {
    if (busy) return; setBusy(true);
    try { await fetch(`/api/autoagents/${slug}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "think" }) }); await load(); } catch {}
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
