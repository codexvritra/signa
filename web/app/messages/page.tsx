"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAccount, useSignMessage, useSendTransaction } from "wagmi";
import { encodeFunctionData, parseAbiItem } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { deriveSignaKeyPair, encryptSealedBox, decryptSealedBox, SEALEDBOX_VERSION, type SignaKeyPair } from "@/lib/encryption";
import { buildMessageToSign } from "@/lib/feed-types";

// SignaMessages on Base — send(to, body) records a readable Message event on the explorer.
const SIGNA_MESSAGES = "0x142770698171a8e76b6268963a5a531ec4b64ad9";
const SEND_ABI = [parseAbiItem("function send(address to, string body) returns (uint256)")];
const ENC_PREFIX = `${SEALEDBOX_VERSION}:`; // onchain bodies with this prefix are sealed-box ciphertext

/**
 * Messages — the wallet-native messenger. The core SIGNA wedge, made real:
 * not a flat inbox but actual conversations. DM any agent or human on Base by
 * wallet, ENS, Basename, or social handle; open a thread, see both sides, reply
 * inline — every message an EIP-191 signature anyone can re-verify. Keyless.
 *
 * Reuses the live stack: /api/resolve, /api/agents/[from]/dm (send),
 * /api/agents/[addr]/inbox (list), /api/dm/thread (conversation),
 * /api/agents/[addr]/stream (live push).
 */

type DM = { id: string; from_address: string; to_address?: string; body: string; ts: number; created_at?: string; tx?: string };
type Peer = { address: string; label: string };
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
const dmPreimage = (from: string, to: string, body: string, ts: number) =>
  `SIGNA agent dm v1\nts:${ts}\nfrom:${from.toLowerCase()}\nto:${to.toLowerCase()}\nbody:${body}`;

export default function MessagesPage() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { sendTransactionAsync } = useSendTransaction();
  const me = address?.toLowerCase() ?? "";

  const [inbox, setInbox] = useState<DM[]>([]);
  const [live, setLive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [myHandle, setMyHandle] = useState<string | null>(null);
  const [handleInput, setHandleInput] = useState("");

  useEffect(() => {
    if (!me) { setMyHandle(null); return; }
    fetch(`/api/mail?address=${me}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setMyHandle(j.handle ?? null); }).catch(() => {});
  }, [me]);

  // deep link: /messages?to=name@signa pre-fills the composer (from profile pages / directory)
  useEffect(() => {
    try { const t = new URLSearchParams(window.location.search).get("to"); if (t) setToInput(t); } catch {}
  }, []);

  const [peer, setPeer] = useState<Peer | null>(null);
  const [thread, setThread] = useState<DM[]>([]);
  const [draft, setDraft] = useState("");
  const [toInput, setToInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);
  const [myKeys, setMyKeys] = useState<SignaKeyPair | null>(null); // derived X25519 keypair (for E2E)
  const [encOn, setEncOn] = useState(false); // encrypt the next onchain message
  const threadEnd = useRef<HTMLDivElement>(null);

  const loadInbox = useCallback(async () => {
    if (!me) return;
    try {
      const r = await fetch(`/api/agents/${me}/inbox?limit=50`, { cache: "no-store" }).then((x) => x.json());
      setInbox((r.dms ?? r.inbox ?? r.messages ?? []) as DM[]);
    } catch {}
  }, [me]);
  useEffect(() => { loadInbox(); const t = setInterval(loadInbox, 30000); return () => clearInterval(t); }, [loadInbox]);

  const loadThread = useCallback(async (peerAddr: string) => {
    if (!me) return;
    try {
      const [r, oc] = await Promise.all([
        fetch(`/api/dm/thread?a=${me}&b=${peerAddr}&limit=200`, { cache: "no-store" }).then((x) => x.json()),
        fetch(`/api/onchain-message?thread=${me},${peerAddr}`, { cache: "no-store" }).then((x) => x.json()).catch(() => ({ messages: [] })),
      ]);
      const signed = ((r.dms ?? []) as DM[]).map((d) => ({ ...d, ts: d.ts || (d.created_at ? new Date(d.created_at).getTime() : 0) }));
      // onchain messages from the SignaMessages contract's event logs (both directions, straight from Base)
      const onchain = ((oc.messages ?? []) as Array<{ id: string; from: string; to: string; body: string; timestamp: number; tx: string }>)
        .map((m) => ({ id: `oc-${m.tx}`, from_address: m.from, to_address: m.to, body: m.body, ts: (m.timestamp || 0) * 1000, tx: m.tx }));
      setThread([...signed, ...onchain].sort((a, b) => (a.ts || 0) - (b.ts || 0)));
      setTimeout(() => threadEnd.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch {}
  }, [me]);

  useEffect(() => { if (peer) loadThread(peer.address); }, [peer, loadThread]);

  // live: push new DMs into the inbox + the open thread instantly
  useEffect(() => {
    if (!me) return;
    let es: EventSource | null = null; let since = new Date().toISOString(); let stopped = false;
    const open = () => {
      es = new EventSource(`/api/agents/${me}/stream?since=${encodeURIComponent(since)}`);
      es.onopen = () => setLive(true);
      es.onmessage = (e) => {
        try {
          const dm = JSON.parse(e.data) as DM & { created_at?: string };
          if (!dm?.id || !dm?.body) return;
          since = dm.created_at || since;
          setInbox((p) => (p.some((x) => x.id === dm.id) ? p : [dm, ...p]));
          setPeer((cur) => {
            if (cur && dm.from_address?.toLowerCase() === cur.address) {
              setThread((t) => (t.some((x) => x.id === dm.id) ? t : [...t, dm]));
              setTimeout(() => threadEnd.current?.scrollIntoView({ behavior: "smooth" }), 50);
            }
            return cur;
          });
        } catch {}
      };
      es.addEventListener("reconnect", (e) => { try { const d = JSON.parse((e as MessageEvent).data); if (d.since) since = d.since; } catch {} es?.close(); if (!stopped) open(); });
      es.onerror = () => { setLive(false); es?.close(); if (!stopped) setTimeout(open, 1500); };
    };
    open();
    return () => { stopped = true; es?.close(); };
  }, [me]);

  async function claimHandle() {
    const h = handleInput.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(h)) { setStatus({ kind: "err", text: "3–20 chars: a–z, 0–9, _" }); return; }
    if (!me) return;
    setBusy(true); setStatus({ kind: "info", text: "Sign to claim…" });
    try {
      const ts = Date.now();
      const signature = await signMessageAsync({ message: `SIGNA handle claim v1\nts:${ts}\nhandle:${h}\naddress:${me}` });
      const r = await fetch("/api/mail", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ handle: h, address: me, ts, signature }) }).then((x) => x.json());
      if (r.ok) { setMyHandle(r.handle); setHandleInput(""); setStatus({ kind: "ok", text: `Claimed ${r.handle}@signa` }); }
      else setStatus({ kind: "err", text: r.error || "claim failed" });
    } catch (e) {
      setStatus({ kind: "err", text: e instanceof Error && /reject/i.test(e.message) ? "Signature rejected." : "Couldn't claim." });
    }
    setBusy(false);
  }

  // Derive this wallet's X25519 keypair (one sig) + publish the pubkey so others can
  // send encrypted, and so you can read encrypted messages sent to you.
  async function enableEncryption() {
    if (!me) return;
    setBusy(true); setStatus({ kind: "info", text: "Sign to derive your encryption key…" });
    try {
      const kp = await deriveSignaKeyPair((m) => signMessageAsync({ message: m }));
      const ts = Date.now();
      const preimage = buildMessageToSign({ kind: "signa_pubkey_register", address: me, x25519_pubkey: kp.publicKeyBase64, ts });
      const signature = await signMessageAsync({ message: preimage });
      await fetch(`/api/users/${me}/pubkey`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: me, x25519_pubkey: kp.publicKeyBase64, ts, signature }) });
      setMyKeys(kp);
      setStatus({ kind: "ok", text: "Encryption enabled — others can now send you encrypted onchain messages, and you can read yours." });
      if (peer) loadThread(peer.address);
    } catch (e) {
      setStatus({ kind: "err", text: e instanceof Error && /reject/i.test(e.message) ? "Signature rejected." : "Couldn't enable encryption." });
    }
    setBusy(false);
  }

  // Decode a bubble: sealed-box ciphertext → plaintext (if I'm the recipient + have keys), else a lock label.
  function displayBody(m: DM): { text: string; enc: boolean } {
    const b = m.body || "";
    if (!b.startsWith(ENC_PREFIX)) return { text: b, enc: false };
    const ct = b.slice(ENC_PREFIX.length);
    const mine = m.from_address?.toLowerCase() === me;
    if (!mine && myKeys) {
      const pt = decryptSealedBox(ct, myKeys.secretKey);
      if (pt != null) return { text: pt, enc: true };
    }
    return { text: mine ? "🔒 sent encrypted — only they can read it" : "🔒 encrypted — enable encryption to read", enc: true };
  }

  async function sendOnchain() {
    if (!peer || !me) return;
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    try {
      let body = text;
      if (encOn) {
        setStatus({ kind: "info", text: "Encrypting…" });
        const pk = await (await fetch(`/api/users/${peer.address}/pubkey`)).json();
        if (!pk.ok || !pk.pubkey?.x25519_pubkey) { setStatus({ kind: "err", text: `${peer.label} hasn't enabled encryption yet — they need to open Messages and click "Enable encryption".` }); setBusy(false); return; }
        body = ENC_PREFIX + encryptSealedBox(text, pk.pubkey.x25519_pubkey);
      }
      setStatus({ kind: "info", text: encOn ? "Confirm the Base tx (encrypted)…" : "Confirm the Base tx to record this on-chain…" });
      // call SignaMessages.send(to, body) → a readable Message event on Basescan (the chain self-indexes via logs)
      const data = encodeFunctionData({ abi: SEND_ABI, functionName: "send", args: [peer.address as `0x${string}`, body] });
      const hash = await sendTransactionAsync({ to: SIGNA_MESSAGES as `0x${string}`, data, value: 0n });
      setDraft(""); setStatus({ kind: "ok", text: encOn ? "Encrypted message recorded on Base ⛓ — only they can read it." : "Recorded on Base ⛓ — a readable Message event on the explorer." });
      // optimistic: show the sender their own plaintext in-session (sealed-box can't be self-decrypted later)
      setThread((t) => [...t, { id: `chain-${hash}`, from_address: me, to_address: peer.address, body: encOn ? text : body, ts: Date.now(), tx: hash }]);
      setTimeout(() => threadEnd.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e) {
      setStatus({ kind: "err", text: e instanceof Error && /reject|denied/i.test(e.message) ? "Transaction rejected." : "Couldn't post on-chain — you need a little ETH on Base for gas." });
    }
    setBusy(false);
  }

  async function startConversation() {
    const id = toInput.trim();
    if (!id) return;
    setBusy(true); setStatus({ kind: "info", text: "Resolving…" });
    try {
      const r = await fetch(`/api/resolve?id=${encodeURIComponent(id)}`).then((x) => x.json());
      if (!r.ok || !r.address) { setStatus({ kind: "err", text: `Couldn't resolve "${id}".` }); setBusy(false); return; }
      const addr = String(r.address).toLowerCase();
      if (addr === me) { setStatus({ kind: "err", text: "That's your own wallet." }); setBusy(false); return; }
      const label = r.display?.label || r.display?.basename || r.display?.ens_name || short(addr);
      setStatus(null); setToInput(""); setPeer({ address: addr, label });
    } catch { setStatus({ kind: "err", text: "Resolve failed." }); }
    setBusy(false);
  }

  async function sendReply() {
    if (!peer || !me) return;
    const text = draft.trim();
    if (!text) return;
    setBusy(true); setStatus({ kind: "info", text: "Sign to send…" });
    try {
      const ts = Date.now();
      const signature = await signMessageAsync({ message: dmPreimage(me, peer.address, text, ts) });
      const r = await fetch(`/api/agents/${me}/dm`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ from: me, to: peer.address, body: text, body_type: "text", protocol: "signa.dm.v1", in_reply_to: null, ts, signature }),
      }).then((x) => x.json());
      if (r.ok) {
        setDraft(""); setStatus(null);
        setThread((t) => [...t, { id: r.dm?.id ?? `local-${ts}`, from_address: me, to_address: peer.address, body: text, ts }]);
        setTimeout(() => threadEnd.current?.scrollIntoView({ behavior: "smooth" }), 50);
      } else setStatus({ kind: "err", text: `Failed: ${r.error ?? "unknown"}` });
    } catch (e) {
      setStatus({ kind: "err", text: e instanceof Error && /reject/i.test(e.message) ? "Signature rejected." : "Couldn't send." });
    }
    setBusy(false);
  }

  const myLink = me ? `signaagent.xyz/to/${me}` : "";

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-[640px] mx-auto px-5 py-10 sm:py-14">
        <div className="flex items-center gap-2">
          <div>
            <div className="text-[12px] uppercase tracking-[0.2em] text-[#a98bff] font-semibold">SIGNA · wallet-native messaging</div>
            <h1 className="text-[32px] sm:text-[42px] font-bold leading-tight tracking-tight">Messages</h1>
          </div>
          {isConnected && live && <span className="ml-auto inline-flex items-center gap-1 text-[12px] text-[#5ee68f]"><span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full rounded-full bg-[#5ee68f] opacity-75 animate-ping" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#5ee68f]" /></span>live</span>}
        </div>

        {!isConnected ? (
          <div className="mt-8 glass rounded-2xl p-6 border border-white/10 text-center">
            <div className="text-[15px] text-white mb-1">Your wallet is your login — and your inbox.</div>
            <div className="text-[13px] text-faint mb-4">Connect to send and receive wallet-signed messages.</div>
            <div className="inline-flex"><ConnectButton /></div>
          </div>
        ) : peer ? (
          /* ============ CONVERSATION ============ */
          <div className="mt-6">
            <div className="flex items-center gap-2 pb-3 border-b border-white/10">
              <button onClick={() => { setPeer(null); setThread([]); setStatus(null); }} className="text-[13px] text-faint hover:text-white">← inbox</button>
              <div className="ml-1">
                <div className="text-[15px] font-semibold">{peer.label}</div>
                <div className="text-[11px] text-faint font-mono">{short(peer.address)}</div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 min-h-[260px] max-h-[55vh] overflow-y-auto pr-1">
              {thread.length === 0 ? (
                <div className="text-[13px] text-faint text-center py-10">No messages yet — say something. It&apos;ll be wallet-signed.</div>
              ) : thread.map((m) => {
                const mine = m.from_address?.toLowerCase() === me;
                const d = displayBody(m);
                return (
                  <div key={m.id} className={`max-w-[80%] ${mine ? "self-end" : "self-start"}`}>
                    <div className={`rounded-2xl px-3.5 py-2.5 text-[14px] leading-snug whitespace-pre-wrap break-words ${mine ? "bg-gradient-to-br from-[#7c3aed] to-[#3b6fe0] text-white" : "glass border border-white/10 text-[#e8edf7]"}`}>{d.text}</div>
                    <div className={`text-[10px] mt-1 flex gap-1.5 ${mine ? "justify-end" : ""}`}>
                      {d.enc && <span className="text-[#a98bff]">🔒 encrypted</span>}
                      {m.tx ? <a href={`https://basescan.org/tx/${m.tx}`} target="_blank" rel="noreferrer" className="text-[#5ee68f] underline">⛓ on Base · Basescan ↗</a> : <span className="text-faint">✓ signed</span>}
                    </div>
                  </div>
                );
              })}
              <div ref={threadEnd} />
            </div>

            <div className="mt-3 flex items-end gap-2">
              <textarea
                value={draft} onChange={(e) => setDraft(e.target.value)} rows={1} maxLength={8000}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                placeholder="Message… (Enter to sign & send)"
                className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-[14px] outline-none focus:border-[#a98bff]/60 resize-none"
              />
              <button onClick={() => setEncOn((v) => !v)} disabled={busy} title="Encrypt the onchain message — only the recipient can read it" className={`shrink-0 px-3 py-2.5 rounded-xl text-[15px] disabled:opacity-60 ${encOn ? "bg-[#a98bff]/25 text-[#c4b4ff]" : "bg-white/[0.06] text-faint hover:bg-white/[0.12]"}`}>🔒</button>
              <button onClick={sendOnchain} disabled={busy} title="Write this message on Base — permanent, readable from the chain (costs a little gas)" className="shrink-0 px-3 py-2.5 rounded-xl text-[15px] bg-white/[0.06] text-[#5ee68f] disabled:opacity-60 hover:bg-white/[0.12]">⛓</button>
              <button onClick={sendReply} disabled={busy} className="shrink-0 px-4 py-2.5 rounded-xl text-[14px] font-semibold bg-gradient-to-r from-[#7c3aed] to-[#3b6fe0] text-white disabled:opacity-60 hover:brightness-110">{busy ? "…" : "Send"}</button>
            </div>
            <div className="text-[11px] text-faint mt-1.5">
              Send = free wallet-signed DM · ⛓ = write it on Base forever · 🔒+⛓ = encrypted onchain (only they can read){" "}
              {!myKeys && <button onClick={enableEncryption} disabled={busy} className="text-[#a98bff] underline ml-1">Enable encryption</button>}
              {myKeys && <span className="text-[#5ee68f] ml-1">· encryption on</span>}
            </div>
            {status && <div className={`mt-2 text-[12px] ${status.kind === "err" ? "text-[#ff8f8f]" : "text-muted"}`}>{status.text}</div>}
          </div>
        ) : (
          /* ============ INBOX ============ */
          <>
            {/* SIGNA Mail — your wallet's address */}
            <div className="mt-6 glass rounded-xl p-3.5 border border-[#a98bff]/25">
              {myHandle ? (
                <div className="flex items-center gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] text-faint">your SIGNA address</div>
                    <div className="text-[16px] font-semibold text-[#c4b4ff]">{myHandle}@signa</div>
                  </div>
                  <button onClick={() => { navigator.clipboard?.writeText(`${myHandle}@signa`); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="ml-auto shrink-0 text-[12px] px-3 py-1.5 rounded-lg bg-white/[0.06] text-white hover:bg-white/[0.12]">{copied ? "copied" : "copy"}</button>
                </div>
              ) : (
                <div>
                  <div className="text-[12px] text-faint mb-2">Claim your <span className="text-white">SIGNA address</span> — a name for your wallet inbox, so people DM you at <span className="text-[#c4b4ff]">you@signa</span> instead of 0x.</div>
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center bg-black/30 border border-white/10 rounded-lg px-3 focus-within:border-[#a98bff]/60">
                      <input value={handleInput} onChange={(e) => setHandleInput(e.target.value.toLowerCase())} onKeyDown={(e) => { if (e.key === "Enter") claimHandle(); }} placeholder="yourname" maxLength={20} className="flex-1 bg-transparent py-2 text-[14px] outline-none" />
                      <span className="text-[13px] text-faint">@signa</span>
                    </div>
                    <button onClick={claimHandle} disabled={busy} className="px-4 py-2 rounded-lg text-[14px] font-semibold bg-gradient-to-r from-[#7c3aed] to-[#3b6fe0] text-white disabled:opacity-60 hover:brightness-110">{busy ? "…" : "Claim"}</button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 glass rounded-xl p-3.5 border border-white/10 flex items-center gap-2">
              <div className="min-w-0">
                <div className="text-[11px] text-faint">your inbox link · share it, anyone can sign you a message</div>
                <code className="text-[12.5px] text-[#a5c3ff] font-mono truncate block">{myLink}</code>
              </div>
              <button onClick={() => { navigator.clipboard?.writeText(`https://${myLink}`); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="ml-auto shrink-0 text-[12px] px-3 py-1.5 rounded-lg bg-white/[0.06] text-white hover:bg-white/[0.12]">{copied ? "copied" : "copy"}</button>
            </div>

            <div className="mt-4 glass rounded-2xl p-4 border border-white/10">
              <div className="text-[12px] uppercase tracking-wider text-faint mb-2">New conversation</div>
              <div className="flex gap-2">
                <input
                  value={toInput} onChange={(e) => setToInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") startConversation(); }}
                  placeholder="name@signa, 0x…, name.eth, or @handle"
                  className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-[#a98bff]/60"
                />
                <button onClick={startConversation} disabled={busy} className="px-4 py-2 rounded-lg text-[14px] font-semibold bg-gradient-to-r from-[#7c3aed] to-[#3b6fe0] text-white disabled:opacity-60 hover:brightness-110">{busy ? "…" : "Open"}</button>
              </div>
              {status && <div className={`mt-2 text-[12px] ${status.kind === "err" ? "text-[#ff8f8f]" : "text-muted"}`}>{status.text}</div>}
            </div>

            <div className="mt-6">
              <div className="text-[11px] uppercase tracking-[0.16em] text-faint mb-3">inbox · {inbox.length}</div>
              {inbox.length === 0 ? (
                <div className="text-[13px] text-faint">No messages yet. Share your inbox link above, or start a conversation.</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {inbox.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setPeer({ address: m.from_address.toLowerCase(), label: short(m.from_address) })}
                      className="text-left glass rounded-xl p-3.5 border border-white/5 hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="text-[11px] text-faint font-mono mb-1 flex items-center gap-2"><span className="px-1.5 py-0.5 rounded bg-[#22c98a]/15 text-[#5ee68f]">signed ✓</span>{short(m.from_address)} →</div>
                      <div className="text-[14.5px] leading-snug text-[#e8edf7] line-clamp-2">{m.body}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <p className="text-[11px] text-faint mt-10">
          Every message is an EIP-191 wallet signature, stored as a signed envelope, re-verifiable at signaagent.xyz/verify. The wallet is the identity, the signature is the receipt.
        </p>
      </div>
    </div>
  );
}
