"use client";

export type LiveSlice =
  | { live: true; session: { agent_slug: string; obsession: string; live_url: string } }
  | { live: false; session: { agent_slug: string; obsession: string; page_url: string; screenshot_b64: string; captured_at: string } }
  | { live: false; session: null }
  | null;

const ago = (iso: string) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
};

/**
 * The actual browser the agent is using, rendered as a browser-chrome frame
 * — matches 9e9.world's own hero layout (URL bar + live/last-seen indicator
 * + the real page). `live` embeds the genuine Browserbase session (an
 * iframe of the actual running browser, over the same websocket-backed
 * Live View 9e9.world uses); otherwise falls back to the last real
 * screenshot the agent captured so this is never an empty box.
 */
export function BrowserView({ slice, height = 260 }: { slice: LiveSlice; height?: number }) {
  if (!slice || !slice.session) {
    return (
      <div style={{ border: "1px solid #262626", background: "#000", height, display: "flex", alignItems: "center", justifyContent: "center", color: "#5a5a57", fontSize: 12.5, fontFamily: "var(--mono, monospace)" }}>
        {slice === null ? "connecting…" : "no agent has browsed yet"}
      </div>
    );
  }

  const { session } = slice;
  const url = slice.live ? new URL((session as { live_url: string }).live_url).host : (session as { page_url: string }).page_url;

  return (
    <div style={{ border: "1px solid #262626", background: "#000", fontFamily: "var(--mono, monospace)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", borderBottom: "1px solid #262626", fontSize: 11.5 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#5a5a57" }} />
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#5a5a57" }} />
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#5a5a57" }} />
        <span style={{ color: "#8a8a86", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginLeft: 6 }}>{url}</span>
        {slice.live ? (
          <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#3fd48b", fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3fd48b", boxShadow: "0 0 0 3px rgba(63,212,139,0.25)" }} />
            live_
          </span>
        ) : (
          <span style={{ color: "#5a5a57" }}>{ago((session as { captured_at: string }).captured_at)}</span>
        )}
      </div>
      <div style={{ padding: "6px 10px", fontSize: 11.5, color: "#8a8a86", borderBottom: "1px solid #171717" }}>
        ${session.agent_slug} · researching {session.obsession}
      </div>
      {slice.live ? (
        <iframe
          src={(session as { live_url: string }).live_url}
          title="live agent browser session"
          style={{ width: "100%", height, border: "none", display: "block", background: "#fff" }}
          sandbox="allow-scripts allow-same-origin"
        />
      ) : (
        <img
          src={(session as { screenshot_b64: string }).screenshot_b64}
          alt="last page the agent browsed"
          style={{ width: "100%", height, objectFit: "cover", display: "block" }}
        />
      )}
    </div>
  );
}
