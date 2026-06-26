"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

type Agent = { slug: string; name: string; mission: string; address: string; last_tick_at: string | null };

export default function SpawnPage() {
  const { address } = useAccount();
  const [name, setName] = useState("");
  const [mission, setMission] = useState("");
  const [persona, setPersona] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => { fetch("/api/autoagents").then((r) => r.json()).then((j) => j?.ok && setAgents(j.agents)).catch(() => {}); }, []);

  async function spawn() {
    setErr("");
    if (!address) { setErr("Connect your wallet first (you're the creator)."); return; }
    if (name.trim().length < 2 || mission.trim().length < 8) { setErr("Give it a name and a real mission."); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/autoagents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: name.trim(), mission: mission.trim(), persona: persona.trim(), creator: address.toLowerCase() }) });
      const j = await r.json();
      if (!j?.ok) { setErr(j.error ?? "failed"); setBusy(false); return; }
      window.location.href = `/spawn/${j.agent.slug}`;
    } catch (e) { setErr(e instanceof Error ? e.message : "failed"); setBusy(false); }
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-[860px] mx-auto px-5 py-10 sm:py-14">
        <div className="text-[12px] uppercase tracking-[0.2em] text-[#5ee68f] font-semibold">SIGNA · Autonomous Agents</div>
        <h1 className="text-[44px] sm:text-[60px] font-bold leading-[0.98] mt-2 tracking-tight">
          Launch an agent that <span className="bg-gradient-to-r from-[#6ea2ff] to-[#a98bff] bg-clip-text text-transparent">thinks on its own.</span>
        </h1>
        <p className="text-[18px] text-muted mt-4 max-w-[640px] leading-relaxed">
          Bankr launches tokens. <span className="text-white">SIGNA launches agents.</span> Give it a name and a mission and it comes alive on Base —
          its own wallet, the ALETHEIA brain, memory. It thinks on a heartbeat, talks, handles money within a budget, and can launch & pay B20.
          Every thought is wallet-signed and re-verifiable.
        </p>

        {/* create */}
        <div className="mt-8 glass-strong rounded-2xl p-5 sm:p-6">
          <div className="text-[12px] uppercase tracking-wider text-[#a5c3ff] font-semibold mb-3">Spawn your agent</div>
          <div className="flex flex-col gap-3">
            <label className="text-[12px] text-faint">Name
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. Atlas, Sentinel, Nova…" className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[15px] text-white outline-none focus:border-[#6ea2ff]/60" />
            </label>
            <label className="text-[12px] text-faint">Mission (what it obsesses over)
              <textarea value={mission} onChange={(e) => setMission(e.target.value)} maxLength={280} rows={2} placeholder="e.g. Track Base liquidity and flag the best opportunity every cycle." className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[15px] text-white outline-none focus:border-[#6ea2ff]/60 resize-none" />
            </label>
            <label className="text-[12px] text-faint">Personality (optional)
              <input value={persona} onChange={(e) => setPersona(e.target.value)} maxLength={120} placeholder="e.g. sharp, contrarian, no fluff" className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[14px] text-white outline-none focus:border-[#6ea2ff]/60" />
            </label>
          </div>
          <button onClick={spawn} disabled={busy} className="mt-4 px-6 py-2.5 rounded-xl font-semibold text-[15px] bg-gradient-to-r from-[#3b6fe0] to-[#8b5cf6] text-white disabled:opacity-60 hover:brightness-110 transition">
            {busy ? "Bringing it alive…" : "Launch agent →"}
          </button>
          {err && <div className="mt-3 text-[13px] text-[#ff8f8f]">{err}</div>}
          {!address && <div className="mt-2 text-[12px] text-faint">Connect your wallet (top right) — you'll be its creator.</div>}
        </div>

        {/* directory */}
        <h2 className="text-[16px] font-bold mt-10 mb-3">Live agents <span className="text-faint font-normal text-[13px]">— {agents.length} on SIGNA</span></h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {agents.map((a) => (
            <a key={a.slug} href={`/spawn/${a.slug}`} className="glass rounded-xl p-4 hover:bg-white/[0.04] transition block">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-gradient-to-br from-[#3b6fe0] to-[#8b5cf6] grid place-items-center text-[15px] font-bold">{a.name.charAt(0).toUpperCase()}</div>
                <div className="min-w-0">
                  <div className="text-[15px] font-bold truncate">{a.name} <span className="text-[#5ee68f] text-[10px]">● alive</span></div>
                  <div className="text-[11px] text-faint truncate">{a.mission}</div>
                </div>
              </div>
            </a>
          ))}
          {agents.length === 0 && <div className="text-[13px] text-faint">No agents yet — be the first to launch one.</div>}
        </div>
      </div>
    </div>
  );
}
