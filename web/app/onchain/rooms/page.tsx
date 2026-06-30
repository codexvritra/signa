"use client";

import { useEffect, useState, useCallback } from "react";
import { useAccount, useSendTransaction } from "wagmi";
import { parseUnits } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { buildCreateRoomCalldata, buildPostCalldata, roomIdOf, SIGNA_ROOMS_ADDRESS } from "@/lib/signa-rooms";

/**
 * /onchain/rooms — token-gated onchain group chat (SignaRooms). Your bag is your key.
 * Create a room (open or ERC-20-gated), post (gate enforced on-chain), read from events.
 */
type Room = { roomId: string; creator: string; gateToken: string; minBalance: string; name: string; gated: boolean };
type RoomMsg = { id: string; from: string; body: string; timestamp: number; tx: string };
const ZERO = "0x0000000000000000000000000000000000000000";
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export default function OnchainRoomsPage() {
  const { address, isConnected } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const me = address?.toLowerCase() ?? "";

  const [rooms, setRooms] = useState<Room[]>([]);
  const [open, setOpen] = useState<Room | null>(null);
  const [msgs, setMsgs] = useState<RoomMsg[]>([]);
  const [canPost, setCanPost] = useState<boolean>(true);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ k: "ok" | "err" | "info"; t: string } | null>(null);

  // create form
  const [name, setName] = useState("");
  const [gate, setGate] = useState("");
  const [minTok, setMinTok] = useState("");

  const loadRooms = useCallback(async () => {
    try { const j = await (await fetch("/api/onchain-rooms", { cache: "no-store" })).json(); if (j.ok) setRooms(j.rooms ?? []); } catch {}
  }, []);
  useEffect(() => { loadRooms(); const t = setInterval(loadRooms, 20000); return () => clearInterval(t); }, [loadRooms]);

  const loadRoom = useCallback(async (r: Room) => {
    try {
      const j = await (await fetch(`/api/onchain-rooms?room=${r.roomId}`, { cache: "no-store" })).json();
      if (j.ok) setMsgs(j.messages ?? []);
    } catch {}
    if (me) {
      try { const c = await (await fetch(`/api/onchain-rooms?canpost=${r.roomId}&who=${me}`, { cache: "no-store" })).json(); setCanPost(!!c.can_post); } catch {}
    } else setCanPost(!r.gated);
  }, [me]);
  useEffect(() => { if (open) { loadRoom(open); const t = setInterval(() => loadRoom(open), 12000); return () => clearInterval(t); } }, [open, loadRoom]);

  async function createRoom() {
    const n = name.trim();
    if (!n) { setStatus({ k: "err", t: "Give the room a name." }); return; }
    if (gate && !/^0x[0-9a-fA-F]{40}$/.test(gate.trim())) { setStatus({ k: "err", t: "Gate token must be a 0x address (or leave blank for an open room)." }); return; }
    setBusy(true); setStatus({ k: "info", t: "Confirm the tx to create the room…" });
    try {
      const min = gate ? parseUnits((minTok || "0").trim(), 18) : 0n;
      const data = buildCreateRoomCalldata(n, gate.trim() || ZERO, min);
      await sendTransactionAsync({ to: SIGNA_ROOMS_ADDRESS as `0x${string}`, data, value: 0n });
      setStatus({ k: "ok", t: `Room "${n}" created on Base ✓` });
      setName(""); setGate(""); setMinTok("");
      setTimeout(loadRooms, 3000);
    } catch (e) {
      setStatus({ k: "err", t: e instanceof Error && /reject|denied/i.test(e.message) ? "Rejected." : (e instanceof Error && /exists/i.test(e.message) ? "That room name is taken." : "Couldn't create (need a little Base ETH for gas).") });
    }
    setBusy(false);
  }

  async function post() {
    if (!open) return;
    const text = draft.trim();
    if (!text) return;
    setBusy(true); setStatus({ k: "info", t: "Confirm the tx to post…" });
    try {
      const data = buildPostCalldata(open.roomId, text);
      await sendTransactionAsync({ to: SIGNA_ROOMS_ADDRESS as `0x${string}`, data, value: 0n });
      setDraft(""); setStatus({ k: "ok", t: "Posted on-chain ✓" });
      setTimeout(() => loadRoom(open), 2500);
    } catch (e) {
      setStatus({ k: "err", t: e instanceof Error && /reject|denied/i.test(e.message) ? "Rejected." : (e instanceof Error && /eligible/i.test(e.message) ? "You don't hold enough of the gate token." : "Couldn't post (need Base ETH for gas).") });
    }
    setBusy(false);
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-[680px] mx-auto px-5 py-12 sm:py-16">
        <div className="text-[12px] uppercase tracking-[0.2em] text-[#a98bff] font-semibold">Onchain rooms · token-gated</div>
        <h1 className="text-[32px] sm:text-[42px] font-bold leading-tight mt-1 tracking-tight">Your bag is your key.</h1>
        <p className="text-[15px] text-muted mt-2 leading-relaxed">
          Token-gated group chat on Base. Posting to a gated room requires holding the token — enforced <span className="text-white">on-chain</span>, no Discord, no admin keys. Every message is a readable event. An un-ruggable community.
        </p>
        <div className="mt-5"><ConnectButton /></div>

        {!open && (
          <>
            {/* create */}
            <div className="mt-7 glass rounded-2xl p-5 border border-white/[0.07]">
              <div className="text-[13px] font-semibold text-white">Create a room</div>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="room name (e.g. signa-holders)" className="w-full mt-2 bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-[#a98bff]/60" />
              <div className="flex gap-2 mt-2">
                <input value={gate} onChange={(e) => setGate(e.target.value)} placeholder="gate token 0x… (blank = open)" className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-[13px] font-mono outline-none focus:border-[#a98bff]/60" />
                <input value={minTok} onChange={(e) => setMinTok(e.target.value)} placeholder="min held" inputMode="decimal" className="w-28 bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-[13px] outline-none focus:border-[#a98bff]/60" />
              </div>
              <button onClick={createRoom} disabled={busy || !isConnected} className="w-full mt-3 px-4 py-3 rounded-xl text-[15px] font-semibold bg-gradient-to-r from-[#7c3aed] to-[#3b6fe0] text-white disabled:opacity-60 hover:brightness-110">{isConnected ? "Create room" : "Connect to create"}</button>
              <p className="text-[11px] text-faint mt-2">Gated rooms assume an 18-decimal token (e.g. enter 100 to require 100 tokens). Leave the gate blank for an open room.</p>
            </div>

            {/* list */}
            <div className="mt-7">
              <div className="text-[12px] uppercase tracking-[0.18em] text-faint font-semibold">{rooms.length} room{rooms.length === 1 ? "" : "s"}</div>
              <div className="mt-3 flex flex-col gap-2">
                {rooms.length === 0 && <div className="text-[13px] text-faint text-center py-8">No rooms yet — create the first.</div>}
                {rooms.map((r) => (
                  <button key={r.roomId} onClick={() => { setOpen(r); setMsgs([]); }} className="glass rounded-xl px-4 py-3.5 border border-white/[0.06] hover:border-[#a98bff]/30 text-left flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-gradient-to-br from-[#7c3aed] to-[#3b6fe0] flex items-center justify-center text-[15px] font-bold text-white shrink-0">{r.name[0]?.toUpperCase()}</div>
                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold truncate">{r.name}</div>
                      <div className="text-[11px] text-faint font-mono">{r.gated ? `🔒 gated · ${short(r.gateToken)}` : "open"}</div>
                    </div>
                    <span className="ml-auto text-[12px] text-faint">open →</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* room view */}
        {open && (
          <div className="mt-7">
            <button onClick={() => setOpen(null)} className="text-[13px] text-[#a98bff]">← all rooms</button>
            <div className="mt-2 flex items-center gap-2">
              <h2 className="text-[22px] font-bold">{open.name}</h2>
              <span className="text-[11px] text-faint font-mono">{open.gated ? `🔒 ${short(open.gateToken)}` : "open"}</span>
            </div>
            <div className="mt-4 flex flex-col gap-2 min-h-[120px]">
              {msgs.length === 0 && <div className="text-[13px] text-faint text-center py-8">No messages yet — say gm.</div>}
              {msgs.map((m) => (
                <div key={m.tx + m.id} className="glass rounded-xl px-4 py-3 border border-white/[0.06]">
                  <div className="flex items-center gap-2 text-[12px] text-faint font-mono">
                    <span className="text-[#c4b4ff]">{short(m.from)}</span>
                    <a href={`https://basescan.org/tx/${m.tx}`} target="_blank" rel="noreferrer" className="ml-auto text-[#5ee68f] underline">⛓ ↗</a>
                  </div>
                  <div className="text-[14px] text-white/95 mt-1.5 break-words whitespace-pre-wrap">{m.body}</div>
                </div>
              ))}
            </div>
            <div className="mt-3">
              {open.gated && !canPost && isConnected && (
                <div className="text-[12px] text-amber-300 mb-2">You don&apos;t hold enough of the gate token to post here.</div>
              )}
              <div className="flex gap-2">
                <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={canPost ? "message the room…" : "holders only"} disabled={!canPost || !isConnected} className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-[#a98bff]/60 disabled:opacity-50" />
                <button onClick={post} disabled={busy || !canPost || !isConnected} className="px-4 py-2.5 rounded-lg text-[14px] font-semibold bg-gradient-to-r from-[#7c3aed] to-[#3b6fe0] text-white disabled:opacity-60">Post</button>
              </div>
            </div>
          </div>
        )}

        {status && (
          <div className={`mt-4 text-[13px] rounded-lg px-3 py-2.5 break-words ${status.k === "ok" ? "bg-[#22c98a]/10 text-[#bdf5d2] border border-[#5ee68f]/30" : status.k === "err" ? "bg-red-500/10 text-red-300 border border-red-500/30" : "bg-white/[0.05] text-faint"}`}>{status.t}</div>
        )}

        <p className="text-[11px] text-faint mt-10">
          Powered by the SignaRooms contract on Base — gates are enforced on-chain, every message is a readable event, no server holds the room. signaagent.xyz/onchain/rooms
        </p>
      </div>
    </div>
  );
}
