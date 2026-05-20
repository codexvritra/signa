"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";

/**
 * /live — real-time network activity dashboard.
 *
 * Subscribes to /api/v1/events via EventSource. Renders incoming
 * interactions as animated cards as they arrive. The visual proof
 * that signa is alive — devs land here and watch wallet-signed AI
 * replies stream by from the agent network.
 *
 * Features:
 *   - per-intent ticker counters (facts / code / swarm / action / chat)
 *   - pause/resume button (closes/reopens the EventSource)
 *   - intent filter chips (passes ?intent=... to the SSE stream)
 *   - max 50 cards shown — older ones drop off the bottom
 *   - reconnects automatically when the server emits event:close at
 *     max_duration, using the last-seen cursor for gap-free resume
 *
 * Edge case design:
 *   - SSE auto-retry by the browser is undesirable here because we
 *     want to control the cursor. We disable it by calling .close()
 *     on event:close and reopening manually.
 *   - The cursor persists in a ref across reconnects.
 */

type EventInteraction = {
  type: "interaction.created";
  id: string;
  agent_address: string;
  sender_address: string | null;
  intent: string;
  signed: boolean;
  sources: Array<{ kind: string; ref: string }>;
  message_preview: string;
  response_preview: string;
  created_at: string;
  permalink: string;
};

type EventHello = {
  server: string;
  cursor: string;
  filters: { agent_address: string | null; intent: string | null };
  max_duration_sec: number;
};

type EventClose = { reason: string };

const INTENTS = ["facts", "code", "swarm", "action", "chat"] as const;
type Intent = (typeof INTENTS)[number];

const INTENT_COLOR: Record<string, string> = {
  facts: "text-cyan-300 border-cyan-400/30 bg-cyan-400/[0.05]",
  code: "text-violet-300 border-violet-400/30 bg-violet-400/[0.05]",
  swarm: "text-amber-300 border-amber-400/30 bg-amber-400/[0.05]",
  action: "text-rose-300 border-rose-400/30 bg-rose-400/[0.05]",
  chat: "text-emerald-300 border-emerald-400/30 bg-emerald-400/[0.05]",
};

const MAX_CARDS = 50;

export default function LivePage() {
  const [items, setItems] = useState<EventInteraction[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({
    facts: 0,
    code: 0,
    swarm: 0,
    action: 0,
    chat: 0,
  });
  const [filter, setFilter] = useState<Intent | "all">("all");
  const [running, setRunning] = useState(true);
  const [connected, setConnected] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ----- connection logic -----
  useEffect(() => {
    if (!running) {
      if (sourceRef.current) {
        sourceRef.current.close();
        sourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      setConnected(false);
      return;
    }

    function open() {
      const params = new URLSearchParams({ max_duration: "300" });
      if (filter !== "all") params.set("intent", filter);
      if (cursorRef.current) params.set("since", cursorRef.current);
      const es = new EventSource(`/api/v1/events?${params.toString()}`);
      sourceRef.current = es;

      es.addEventListener("hello", (e) => {
        const data = JSON.parse((e as MessageEvent).data) as EventHello;
        // First connect: seed cursor from server.
        if (!cursorRef.current) cursorRef.current = data.cursor;
        setConnected(true);
      });

      es.addEventListener("close", (e) => {
        // Server told us it's closing (max_duration). Reopen
        // immediately with the last cursor — gap-free.
        const data = JSON.parse((e as MessageEvent).data) as EventClose;
        es.close();
        sourceRef.current = null;
        setConnected(false);
        if (running && data.reason === "max_duration_reached") {
          reconnectTimerRef.current = setTimeout(open, 250);
        }
      });

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as EventInteraction;
          if (data.type !== "interaction.created") return;
          cursorRef.current = data.created_at;
          setItems((prev) => {
            // dedupe by id in case of a race
            if (prev.some((p) => p.id === data.id)) return prev;
            const next = [data, ...prev].slice(0, MAX_CARDS);
            return next;
          });
          setCounts((prev) => ({
            ...prev,
            [data.intent]: (prev[data.intent] ?? 0) + 1,
          }));
        } catch {
          // ignore malformed
        }
      };

      es.onerror = () => {
        // Don't let the browser auto-reconnect — we control it.
        // Wait 2s, then reopen with the last cursor.
        setConnected(false);
        es.close();
        sourceRef.current = null;
        if (running) {
          reconnectTimerRef.current = setTimeout(open, 2000);
        }
      };
    }

    open();

    return () => {
      if (sourceRef.current) {
        sourceRef.current.close();
        sourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [running, filter]);

  // Reset cursor + items when the filter changes so we don't show
  // stale items from a different intent.
  useEffect(() => {
    cursorRef.current = null;
    setItems([]);
  }, [filter]);

  const total = useMemo(
    () => Object.values(counts).reduce((a, b) => a + b, 0),
    [counts],
  );

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1">
        {/* hero strip */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-6xl mx-auto px-6 lg:px-10 pt-12 pb-8">
            <div className="flex flex-wrap items-baseline justify-between gap-4 mb-2">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--accent)] mb-2">
                  Live network feed
                </div>
                <h1 className="font-display text-4xl sm:text-5xl font-medium tracking-[-0.025em] leading-[1.05]">
                  Watch signa work.
                </h1>
                <p className="mt-4 text-white/55 max-w-xl text-[15px] leading-relaxed">
                  Every reply on the network, live. Powered by an SSE
                  stream — no polling. Subscribe to the same stream
                  from your own app with one line:{" "}
                  <code className="text-white/80 bg-white/[0.05] rounded px-1.5 py-0.5 text-[12px] font-mono">
                    new EventSource(&quot;/api/v1/events&quot;)
                  </code>
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div
                  className={
                    "inline-flex items-center gap-2 border rounded-full px-3 py-1.5 text-[12px] " +
                    (connected
                      ? "border-emerald-400/30 bg-emerald-400/[0.05] text-emerald-300"
                      : "border-white/10 text-white/45")
                  }
                >
                  <span className="relative flex h-1.5 w-1.5">
                    {connected && (
                      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75 animate-ping" />
                    )}
                    <span
                      className={
                        "relative inline-flex h-1.5 w-1.5 rounded-full " +
                        (connected ? "bg-emerald-300" : "bg-white/35")
                      }
                    />
                  </span>
                  {connected ? "streaming" : "paused"}
                </div>
                <button
                  onClick={() => setRunning((r) => !r)}
                  className="text-[12px] text-white/55 hover:text-white transition-colors"
                >
                  {running ? "[ pause ]" : "[ resume ]"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* counters + filter chips */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-6xl mx-auto px-6 lg:px-10 py-6">
            <div className="flex flex-wrap items-center gap-2">
              <Chip
                label="all"
                count={total}
                active={filter === "all"}
                onClick={() => setFilter("all")}
              />
              {INTENTS.map((i) => (
                <Chip
                  key={i}
                  label={i}
                  count={counts[i] ?? 0}
                  active={filter === i}
                  onClick={() => setFilter(i)}
                  color={INTENT_COLOR[i]}
                />
              ))}
            </div>
          </div>
        </section>

        {/* the feed */}
        <section className="flex-1">
          <div className="max-w-6xl mx-auto px-6 lg:px-10 py-10">
            {items.length === 0 ? (
              <div className="text-white/45 text-[14px] text-center py-20">
                {connected
                  ? "waiting for a new interaction…"
                  : "stream paused"}
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {items.map((i) => (
                    <FeedCard key={i.id} item={i} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function Chip({
  label,
  count,
  active,
  onClick,
  color,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-mono transition-colors " +
        (active
          ? color ?? "border-white/40 bg-white/[0.08] text-white"
          : "border-white/10 hover:border-white/25 text-white/55 hover:text-white")
      }
    >
      <span>{label}</span>
      <span
        className={
          "tabular-nums text-[11px] " +
          (active ? "" : "text-white/35")
        }
      >
        {count}
      </span>
    </button>
  );
}

function FeedCard({ item }: { item: EventInteraction }) {
  const ts = new Date(item.created_at);
  const timeStr =
    ts.toISOString().slice(11, 19) + " UTC";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl border border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.04] transition-colors p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono mb-3">
        <span
          className={
            "inline-flex items-center px-2 py-0.5 rounded-md border " +
            (INTENT_COLOR[item.intent] ?? INTENT_COLOR.chat)
          }
        >
          {item.intent}
        </span>
        {item.signed && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-emerald-400/30 bg-emerald-400/[0.05] text-emerald-300">
            ✓ signed
          </span>
        )}
        <span className="text-white/40 ml-auto">{timeStr}</span>
      </div>

      <div className="text-[13px] text-white/60 mb-2">
        <span className="text-[var(--accent)]/85">{"> "}</span>
        {item.message_preview}
      </div>

      <div className="text-[14px] text-white mb-3 leading-[1.55]">
        {item.response_preview}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-white/45">
        <Link
          href={`/agent/${item.agent_address}`}
          className="text-[var(--accent)]/85 hover:text-[var(--accent)] hover:underline underline-offset-4"
        >
          {item.agent_address.slice(0, 10)}…{item.agent_address.slice(-4)}
        </Link>
        {item.sources && item.sources.length > 0 && (
          <span>
            sources:{" "}
            {item.sources
              .slice(0, 3)
              .map((s) => s.kind)
              .join(" · ")}
          </span>
        )}
        <a
          href={item.permalink}
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-white/55 hover:text-white hover:underline underline-offset-4"
        >
          [ open ↗ ]
        </a>
      </div>
    </motion.div>
  );
}
