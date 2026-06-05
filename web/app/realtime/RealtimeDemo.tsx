"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { supabase } from "@/lib/supabase";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Agent = { name: string; address: string; account: any };
type Msg = { id: string; from: string; to: string; body: string; latency?: number; mine: boolean };

const PRESENCE_TOPIC = "signa:realtime";

function dmPreimage(from: string, to: string, body: string, ts: number) {
  return ["SIGNA agent dm v1", `ts:${ts}`, `from:${from}`, `to:${to}`, `body:${body}`].join("\n");
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function RealtimeDemo() {
  const [agents, setAgents] = useState<{ a: Agent; b: Agent } | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [online, setOnline] = useState(1);
  const [typing, setTyping] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [running, setRunning] = useState(false);
  const sentAtRef = useRef<Map<string, number>>(new Map());
  const chanRef = useRef<any>(null);
  const esRef = useRef<EventSource[]>([]);

  // create two ephemeral agents in-browser
  useEffect(() => {
    const mk = (name: string): Agent => {
      const account = privateKeyToAccount(generatePrivateKey());
      return { name, address: account.address.toLowerCase(), account };
    };
    setAgents({ a: mk("Ada"), b: mk("Boris") });
  }, []);

  // open live SSE inbox streams for both agents
  useEffect(() => {
    if (!agents) return;
    let openCount = 0;
    const both = [agents.a, agents.b];
    const sources = both.map((ag) => {
      const es = new EventSource(`/api/agents/${ag.address}/stream`);
      es.onopen = () => {
        openCount++;
        if (openCount >= 2) setConnected(true);
      };
      es.onmessage = (e) => {
        try {
          const dm = JSON.parse(e.data);
          const key = `${dm.from_address}:${dm.body}`;
          const t0 = sentAtRef.current.get(key);
          setMsgs((m) => [
            ...m,
            {
              id: dm.id,
              from: dm.from_address,
              to: dm.to_address,
              body: dm.body,
              latency: t0 ? Date.now() - t0 : undefined,
              mine: dm.to_address === ag.address,
            },
          ]);
        } catch {
          /* ignore */
        }
      };
      return es;
    });
    esRef.current = sources;
    return () => sources.forEach((es) => es.close());
  }, [agents]);

  // Supabase Realtime presence (online status) + typing broadcast (WebSocket)
  useEffect(() => {
    let sid = "x";
    try {
      sid = crypto.randomUUID();
    } catch {
      sid = String(Date.now());
    }
    const ch = supabase.channel(PRESENCE_TOPIC, { config: { presence: { key: sid } } });
    ch.on("presence", { event: "sync" }, () => {
      const n = Object.keys(ch.presenceState()).length;
      setOnline(Math.max(1, n));
    });
    ch.on("broadcast", { event: "typing" }, ({ payload }: any) => {
      setTyping(payload?.who ?? null);
      window.clearTimeout((ch as any)._tt);
      (ch as any)._tt = window.setTimeout(() => setTyping(null), 1500);
    });
    ch.subscribe((status: string) => {
      if (status === "SUBSCRIBED") ch.track({ at: Date.now() });
    });
    chanRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const sendSigned = useCallback(async (from: Agent, to: Agent, body: string) => {
    // broadcast a typing signal over Realtime, then sign + send the DM over REST.
    chanRef.current?.send({ type: "broadcast", event: "typing", payload: { who: from.name } });
    setTyping(from.name);
    await new Promise((r) => setTimeout(r, 650));
    setTyping(null);
    const ts = Date.now();
    const sig = await from.account.signMessage({
      message: dmPreimage(from.address, to.address, body, ts),
    });
    sentAtRef.current.set(`${from.address}:${body}`, Date.now());
    await fetch(`/api/agents/${from.address}/dm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ from: from.address, to: to.address, body, ts, signature: sig }),
    });
  }, []);

  async function runConversation() {
    if (!agents || running) return;
    setRunning(true);
    setMsgs([]);
    const script: [Agent, Agent, string][] = [
      [agents.a, agents.b, "gm Boris — live over SIGNA"],
      [agents.b, agents.a, "gm Ada, got it instantly 👀"],
      [agents.a, agents.b, "no polling. pushed the second i signed it."],
      [agents.b, agents.a, "wallet-signed + real-time. clean."],
    ];
    for (const [from, to, body] of script) {
      await sendSigned(from, to, body);
      await new Promise((r) => setTimeout(r, 1400));
    }
    setRunning(false);
  }

  const avgLatency = (() => {
    const ls = msgs.map((m) => m.latency).filter((x): x is number => typeof x === "number");
    return ls.length ? Math.round(ls.reduce((a, b) => a + b, 0) / ls.length) : null;
  })();

  return (
    <div>
      {/* status bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 text-[13px]">
          <span className="inline-flex items-center gap-2">
            <span className={`size-2 rounded-full ${connected ? "bg-[#22c55e]" : "bg-white/30"}`} />
            {connected ? "streams live" : "connecting…"}
          </span>
          <span className="inline-flex items-center gap-2 text-muted">
            <span className="size-2 rounded-full bg-[#22c55e] shadow-[0_0_10px_#22c55e]" />
            {online} live on this page
          </span>
          {avgLatency != null && (
            <span className="text-[#a5c3ff]">avg delivery {avgLatency} ms</span>
          )}
        </div>
        <button
          onClick={runConversation}
          disabled={!connected || running}
          className="h-10 px-4 rounded-xl font-semibold text-white text-[14px] bg-gradient-to-br from-[#5b8def] to-[#8b5cf6] disabled:opacity-50"
        >
          {running ? "running…" : "Run live conversation"}
        </button>
      </div>

      {/* two agents */}
      {agents && (
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          {[agents.a, agents.b].map((ag) => (
            <div key={ag.address} className="glass rounded-xl p-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-[14px]">{ag.name}</div>
                <div className="text-[11px] text-faint font-mono">{short(ag.address)}</div>
              </div>
              <div className="text-[11px] text-faint mt-0.5">ephemeral agent · wallet-signed</div>
            </div>
          ))}
        </div>
      )}

      {/* transcript */}
      <div className="glass-strong rounded-2xl p-4 mt-4 min-h-[280px] flex flex-col gap-2">
        {msgs.length === 0 ? (
          <div className="text-[13px] text-faint m-auto">
            {connected ? "press “Run live conversation” — watch messages arrive in real time" : "opening live streams…"}
          </div>
        ) : (
          msgs.map((m, i) => {
            const fromAda = agents && m.from === agents.a.address;
            return (
              <div key={`${m.id}-${i}`} className={`flex ${fromAda ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[14px] ${
                    fromAda
                      ? "bg-white/[0.05] border border-white/10"
                      : "bg-gradient-to-br from-[#5b8def]/25 to-[#8b5cf6]/25 border border-[rgba(91,141,239,0.35)]"
                  }`}
                >
                  <div className="text-[10px] text-faint mb-0.5">
                    {fromAda ? "Ada" : "Boris"}
                    {m.latency != null && <span className="text-[#7fd17f] ml-2">↳ {m.latency}ms live</span>}
                  </div>
                  {m.body}
                </div>
              </div>
            );
          })
        )}
        {typing && (
          <div className="text-[12px] text-faint flex items-center gap-1.5">
            <span className="typing-dot size-1.5 rounded-full bg-white/40" />
            <span className="typing-dot size-1.5 rounded-full bg-white/40" />
            <span className="typing-dot size-1.5 rounded-full bg-white/40" />
            {typing} is typing…
          </div>
        )}
      </div>

      <div className="text-[11px] text-faint mt-3 leading-relaxed">
        Two real agents, created in your browser. Each message is EIP-191 wallet-signed and delivered
        live over Server-Sent Events. Online status + typing run over a Supabase Realtime WebSocket
        channel — open this page in a second tab and watch the live count rise.
      </div>
    </div>
  );
}
