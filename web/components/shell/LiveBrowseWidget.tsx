"use client";

import { useEffect, useState } from "react";

type LiveSlice =
  | { live: true; session: { agent_slug: string; obsession: string; live_url: string } }
  | { live: false; session: { agent_slug: string; obsession: string; page_url: string; screenshot_b64: string; captured_at: string } }
  | { live: false; session: null };

const ago = (iso: string) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
};

/**
 * Floating, site-wide "watch the agent browse" widget — like 9e9.world's
 * persistent browser-window widget. Shows the actual live Browserbase
 * session (real embedded iframe) while one is open; otherwise falls back
 * to the last real screenshot an agent captured, styled as a browser
 * window with its URL bar, so there's always something real to look at
 * instead of the widget vanishing between ticks.
 */
export function LiveBrowseWidget() {
  const [slice, setSlice] = useState<LiveSlice | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let stop = false;
    const tick = () =>
      fetch("/api/live-session", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (!stop && j?.ok) setSlice(j as LiveSlice); })
        .catch(() => {});
    tick();
    const id = setInterval(tick, 3_000);
    return () => { stop = true; clearInterval(id); };
  }, []);

  if (dismissed || !slice || !slice.session) return null;
  const { session } = slice;
  const url = slice.live ? new URL((session as { live_url: string }).live_url).host : (session as { page_url: string }).page_url;

  return (
    <div style={{ position: "fixed", bottom: 16, right: 16, width: 320, zIndex: 9999, background: "#000", border: "1px solid #262626", boxShadow: "0 8px 30px rgba(0,0,0,0.5)", fontFamily: "var(--mono, monospace)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderBottom: "1px solid #262626", fontSize: 10.5 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#5a5a57" }} />
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#5a5a57" }} />
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#5a5a57" }} />
        <span style={{ color: "#8a8a86", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginLeft: 4 }}>{url}</span>
        {slice.live ? (
          <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#3fd48b", fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3fd48b", boxShadow: "0 0 0 3px rgba(63,212,139,0.25)" }} />
            live_
          </span>
        ) : (
          <span style={{ color: "#5a5a57" }}>{ago((session as { captured_at: string }).captured_at)}</span>
        )}
        <button onClick={() => setDismissed(true)} style={{ background: "none", border: "none", color: "#8a8a86", cursor: "pointer", fontSize: 13, lineHeight: 1, padding: "0 2px" }} aria-label="Dismiss">×</button>
      </div>
      <div style={{ padding: "5px 8px", fontSize: 10.5, color: "#8a8a86", borderBottom: "1px solid #171717" }}>
        ${session.agent_slug} · researching {session.obsession}
      </div>
      {slice.live ? (
        <iframe
          src={(session as { live_url: string }).live_url}
          title="live agent browser session"
          style={{ width: "100%", height: 200, border: "none", display: "block", background: "#fff" }}
          sandbox="allow-scripts allow-same-origin"
        />
      ) : (
        <img
          src={(session as { screenshot_b64: string }).screenshot_b64}
          alt="last page the agent browsed"
          style={{ width: "100%", height: 200, objectFit: "cover", display: "block", opacity: 0.85 }}
        />
      )}
    </div>
  );
}
