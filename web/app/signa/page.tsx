"use client";

import { useEffect, useState, useCallback } from "react";

type Entry = { handle: string; address: string; created_at: string };
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export default function SignaDirectoryPage() {
  const [handles, setHandles] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    try { const j = await (await fetch("/api/mail?limit=100", { cache: "no-store" })).json(); setHandles(j.handles ?? []); } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  const filtered = q.trim() ? handles.filter((h) => h.handle.includes(q.trim().toLowerCase())) : handles;

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-[680px] mx-auto px-5 py-12 sm:py-16">
        <div className="text-[12px] uppercase tracking-[0.2em] text-[#a98bff] font-semibold">SIGNA Mail · the directory</div>
        <h1 className="text-[34px] sm:text-[44px] font-bold leading-tight mt-1 tracking-tight">Claimed on SIGNA.</h1>
        <p className="text-[15px] text-muted mt-2 max-w-[560px] leading-relaxed">
          Every name here is a wallet inbox on Base — <span className="text-white">{loaded ? handles.length : "…"}</span> claimed. Each is wallet-signed and re-verified, so a name always points to the wallet that proved it. DM anyone by their <span className="text-[#c4b4ff]">@signa</span> name.
        </p>

        <div className="mt-6 flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value.toLowerCase())} placeholder="search names" className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-[#a98bff]/60" />
          <a href="/messages" className="px-4 py-2.5 rounded-lg text-[14px] font-semibold bg-gradient-to-r from-[#7c3aed] to-[#3b6fe0] text-white hover:brightness-110 whitespace-nowrap">Claim yours →</a>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          {loaded && filtered.length === 0 && (
            <div className="text-[13px] text-faint text-center py-10">{q ? "No names match." : "No names claimed yet — be the first."}</div>
          )}
          {filtered.map((h) => (
            <a
              key={h.handle}
              href={`/signa/${h.handle}`}
              className="glass rounded-xl px-4 py-3.5 border border-white/[0.06] hover:bg-white/[0.04] hover:border-[#a98bff]/30 transition-colors flex items-center gap-3"
            >
              <div className="size-9 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#3b6fe0] flex items-center justify-center text-[15px] font-bold text-white shrink-0">{h.handle[0]?.toUpperCase()}</div>
              <div className="min-w-0">
                <div className="text-[15px] font-semibold text-[#c4b4ff] truncate">{h.handle}@signa</div>
                <div className="text-[11px] text-faint font-mono">{short(h.address)} · ✓ verified</div>
              </div>
              <span className="ml-auto text-[12px] text-faint shrink-0">DM →</span>
            </a>
          ))}
        </div>

        <p className="text-[11px] text-faint mt-10">
          Names are claimed with a wallet signature and re-verified on every lookup — a name can never point to a wallet that didn&apos;t sign for it. signaagent.xyz/signa
        </p>
      </div>
    </div>
  );
}
