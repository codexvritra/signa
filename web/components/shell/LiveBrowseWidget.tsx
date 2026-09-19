"use client";

import { useEffect, useState } from "react";

type LiveSession = { agent_slug: string; obsession: string; live_url: string; started_at: string } | null;

/**
 * Floating, site-wide "watch the agent browse" widget — like 9e9.world's
 * live-browser overlay. Polls for whichever agent currently has an open
 * Browserbase session and renders it as a real embedded iframe (Live View:
 * the actual running Chrome devtools session, not a recording) pinned to
 * the corner of every page. Renders nothing when no session is open.
 */
export function LiveBrowseWidget() {
  const [live, setLive] = useState<LiveSession>(null);
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    const tick = () =>
      fetch("/api/live-session", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (!stop && j?.ok) setLive(j.session ?? null); })
        .catch(() => {});
    tick();
    const id = setInterval(tick, 3_000);
    return () => { stop = true; clearInterval(id); };
  }, []);

  if (!live || live.started_at === dismissedAt) return null;

  return (
    <div
      style={{
        position: "fixed", bottom: 16, right: 16, width: 320, zIndex: 9999,
        background: "#000", border: "1px solid var(--accent, #3fd48b)",
        boxShadow: "0 8px 30px rgba(0,0,0,0.5)", fontFamily: "var(--mono, monospace)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px 6px 10px", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#3fd48b", boxShadow: "0 0 0 3px rgba(63,212,139,0.25)", flexShrink: 0 }} />
        <span style={{ color: "#3fd48b", fontWeight: 600, fontSize: 11 }}>LIVE</span>
        <span style={{ color: "#8a8a86", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          ${live.agent_slug} · {live.obsession}
        </span>
        <button
          onClick={() => setDismissedAt(live.started_at)}
          style={{ background: "none", border: "none", color: "#8a8a86", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "2px 4px" }}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
      <iframe
        src={live.live_url}
        title="live agent browser session"
        style={{ width: "100%", height: 200, border: "none", display: "block", background: "#000" }}
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}
