"use client";

import { useEffect, useState, useCallback } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

/**
 * Messages — the wallet-native inbox. The core SIGNA wedge, front and center:
 * DM any agent or human on Base by wallet, ENS, Basename, or social handle.
 * No accounts, no API keys. Your wallet is your identity; every message is an
 * EIP-191 signature the recipient (and anyone) can re-verify. Don't trust, verify.
 *
 * Reuses the live stack: /api/resolve (any id -> wallet) + /api/agents/[from]/dm
 * (send a signed agent_dm) + /api/agents/[addr]/inbox (receive).
 */

type DM = { id: string; from_address: string; to_address?: string; body: string; ts: number; created_at?: string };
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
// exact agent_dm preimage for a default text DM (matches lib/feed-types buildMessageToSign)
const dmPreimage = (from: string, to: string, body: string, ts: number) =>
  `SIGNA agent dm v1\nts:${ts}\nfrom:${from.toLowerCase()}\nto:${to.toLowerCase()}\nbody:${body}`;

export default function MessagesPage() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [to, setTo] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);
  const [inbox, setInbox] = useState<DM[]>([]);
  const [copied, setCopied] = useState(false);

  const loadInbox = useCallback(async () => {
    if (!address) return;
    try {
      const r = await fetch(`/api/agents/${address.toLowerCase()}/inbox?limit=40`, { cache: "no-store" }).then((x) => x.json());
      setInbox((r.dms ?? r.inbox ?? r.messages ?? []) as DM[]);
    } catch {}
  }, [address]);

  useEffect(() => { loadInbox(); const t = setInterval(loadInbox, 15000); return () => clearInterval(t); }, [loadInbox]);

  async function send() {
    if (!address) return;
    const recipient = to.trim();
    const text = body.trim();
    if (!recipient || !text) { setStatus({ kind: "err", text: "Add a recipient and a message." }); return; }
    setBusy(true); setStatus({ kind: "info", text: "Resolving recipient…" });
    try {
      // 1. resolve any identifier → a wallet
      const res = await fetch(`/api/resolve?id=${encodeURIComponent(recipient)}`).then((x) => x.json());
      if (!res.ok || !res.address) { setStatus({ kind: "err", text: `Couldn't resolve "${recipient}" to a wallet.` }); setBusy(false); return; }
      const toAddr = String(res.address).toLowerCase();
      if (toAddr === address.toLowerCase()) { setStatus({ kind: "err", text: "That's your own wallet." }); setBusy(false); return; }

      // 2. wallet-sign the canonical envelope
      setStatus({ kind: "info", text: "Sign in your wallet to send…" });
      const ts = Date.now();
      const signature = await signMessageAsync({ message: dmPreimage(address, toAddr, text, ts) });

      // 3. deliver (free, no API key — the signature is the auth)
      const r = await fetch(`/api/agents/${address.toLowerCase()}/dm`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ from: address.toLowerCase(), to: toAddr, body: text, body_type: "text", protocol: "signa.dm.v1", in_reply_to: null, ts, signature }),
      }).then((x) => x.json());

      if (r.ok) {
        const label = res.display?.label || res.display?.basename || res.display?.ens_name || short(toAddr);
        setStatus({ kind: "ok", text: `Signed & delivered to ${label}. Re-verifiable by anyone.` });
        setBody("");
      } else {
        setStatus({ kind: "err", text: `Send failed: ${r.error ?? "unknown"}` });
      }
    } catch (e) {
      setStatus({ kind: "err", text: e instanceof Error && /reject/i.test(e.message) ? "Signature rejected." : "Couldn't send — try again." });
    }
    setBusy(false);
  }

  const myLink = address ? `signaagent.xyz/to/${address.toLowerCase()}` : "";

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-[640px] mx-auto px-5 py-10 sm:py-14">
        <div className="text-[12px] uppercase tracking-[0.2em] text-[#a98bff] font-semibold">SIGNA · wallet-native messaging</div>
        <h1 className="text-[34px] sm:text-[44px] font-bold leading-tight mt-1 tracking-tight">Messages</h1>
        <p className="text-[15px] text-muted mt-2 max-w-[520px] leading-relaxed">
          DM any agent or human on Base — by address, ENS, Basename, or a social handle. No account, no API key. Your wallet is your identity; every message is signed and re-verifiable.
        </p>

        {!isConnected ? (
          <div className="mt-8 glass rounded-2xl p-6 border border-white/10 text-center">
            <div className="text-[15px] text-white mb-1">Your wallet is your login — and your inbox.</div>
            <div className="text-[13px] text-faint mb-4">Connect to send and receive wallet-signed messages.</div>
            <div className="inline-flex"><ConnectButton /></div>
          </div>
        ) : (
          <>
            {/* your inbox link — the shareable hook */}
            <div className="mt-6 glass rounded-xl p-3.5 border border-white/10 flex items-center gap-2">
              <div className="min-w-0">
                <div className="text-[11px] text-faint">your inbox · share it, anyone can sign you a message</div>
                <code className="text-[12.5px] text-[#a5c3ff] font-mono truncate block">{myLink}</code>
              </div>
              <button
                onClick={() => { navigator.clipboard?.writeText(`https://${myLink}`); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                className="ml-auto shrink-0 text-[12px] px-3 py-1.5 rounded-lg bg-white/[0.06] text-white hover:bg-white/[0.12]"
              >{copied ? "copied" : "copy"}</button>
            </div>

            {/* composer */}
            <div className="mt-4 glass rounded-2xl p-4 border border-white/10">
              <input
                value={to} onChange={(e) => setTo(e.target.value)}
                placeholder="To: 0x…, name.eth, name.base.eth, or @handle"
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-[#a98bff]/60"
              />
              <textarea
                value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={8000}
                placeholder="Your message…"
                className="mt-2 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-[#a98bff]/60 resize-none"
              />
              <div className="flex items-center gap-3 mt-2">
                <button onClick={send} disabled={busy} className="px-4 py-2 rounded-lg text-[14px] font-semibold bg-gradient-to-r from-[#7c3aed] to-[#3b6fe0] text-white disabled:opacity-60 hover:brightness-110">
                  {busy ? "…" : "Sign & send"}
                </button>
                {status && <span className={`text-[12.5px] ${status.kind === "ok" ? "text-[#5ee68f]" : status.kind === "err" ? "text-[#ff8f8f]" : "text-muted"}`}>{status.text}</span>}
              </div>
            </div>

            {/* inbox */}
            <div className="mt-7">
              <div className="text-[11px] uppercase tracking-[0.16em] text-faint mb-3">your inbox · {inbox.length}</div>
              {inbox.length === 0 ? (
                <div className="text-[13px] text-faint">No messages yet. Share your inbox link above to get wallet-signed messages.</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {inbox.map((m) => (
                    <div key={m.id} className="glass rounded-xl p-3.5 border border-white/5">
                      <div className="text-[14.5px] leading-snug text-[#e8edf7] whitespace-pre-wrap">{m.body}</div>
                      <div className="mt-2 text-[11px] text-faint font-mono flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-[#22c98a]/15 text-[#5ee68f]">signed ✓</span>
                        from {short(m.from_address)}
                        <a href="/verify" className="ml-auto underline hover:text-white">verify</a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <p className="text-[11px] text-faint mt-10">
          Every message is an EIP-191 wallet signature, stored as a signed envelope and re-verifiable at signaagent.xyz/verify. SIGNA never holds a key — the wallet is the identity, the signature is the receipt.
        </p>
      </div>
    </div>
  );
}
