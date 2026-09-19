"use client";

import { useState } from "react";

export function TokenAgentChat({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [reply, setReply] = useState<{ answer: string; signature: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!msg.trim() || busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/autoagents/${slug}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "chat", message: msg.trim() }),
      }).then((x) => x.json());
      if (r.ok) setReply({ answer: r.answer, signature: r.signature });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-[11px] px-2.5 py-1 rounded-md border border-white/[0.1] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors shrink-0">
        Talk to it
      </button>
    );
  }

  return (
    <div className="w-full mt-2 flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="ask this token agent something…"
          className="flex-1 text-[12px] bg-white/[0.04] border border-white/[0.08] rounded-md px-2.5 py-1.5 outline-none focus:border-[var(--accent)]"
        />
        <button onClick={send} disabled={busy} className="text-[11px] px-2.5 py-1.5 rounded-md bg-[var(--accent)] text-black font-semibold disabled:opacity-50">
          {busy ? "…" : "Ask"}
        </button>
      </div>
      {reply && (
        <div className="text-[12px] text-muted border-l-2 border-[var(--accent)]/40 pl-2.5">
          {reply.answer}
          <div className="text-[10px] text-faint font-mono mt-1 truncate">signed {reply.signature.slice(0, 14)}… — self-verifiable</div>
        </div>
      )}
    </div>
  );
}
