"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PassportSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function go(e: React.FormEvent) {
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    setErr("");
    if (/^0x[a-fA-F0-9]{40}$/.test(v)) {
      router.push(`/passport/${v.toLowerCase()}`);
      return;
    }
    // resolve a handle / ENS / basename / @twitter via the universal resolver
    setBusy(true);
    try {
      const r = await fetch(`/api/resolve?id=${encodeURIComponent(v)}`);
      const j = await r.json();
      if (j?.ok && j.address) router.push(`/passport/${j.address}`);
      else setErr("couldn't resolve that to a wallet");
    } catch {
      setErr("resolve failed, try a 0x address");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={go} className="flex flex-col sm:flex-row gap-2 max-w-xl">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="0x address, ENS, basename, or @handle"
        className="flex-1 bg-black/40 border border-white/12 rounded-lg px-4 py-2.5 text-[14px] text-white placeholder:text-white/35 font-mono focus:outline-none focus:border-[var(--accent)]/50"
      />
      <button
        type="submit"
        disabled={busy}
        className="bg-[var(--accent)] text-black font-semibold rounded-lg px-5 py-2.5 text-[14px] hover:brightness-110 transition uppercase tracking-wide disabled:opacity-60"
      >
        {busy ? "resolving…" : "look up"}
      </button>
      {err && <span className="text-[12.5px] text-rose-300 self-center">{err}</span>}
    </form>
  );
}
