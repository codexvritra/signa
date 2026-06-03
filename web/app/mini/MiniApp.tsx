"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { notePreimage, NOTE_MAX_BODY, shortAddr, type SignedNote } from "@/lib/note";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Phase = "idle" | "signing" | "done";

type FcUser = { fid: number; username: string | null; pfpUrl: string | null } | null;

export function MiniApp() {
  const [ready, setReady] = useState(false);
  const [inMini, setInMini] = useState(false);
  const [user, setUser] = useState<FcUser>(null);
  const [body, setBody] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SignedNote | null>(null);
  const [recent, setRecent] = useState<SignedNote[]>([]);
  const sdkRef = useRef<any>(null);

  // Boot the Mini App SDK: call ready() to dismiss the splash, read the
  // Farcaster user context, and detect whether we're inside a Mini App host.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const mod = await import("@farcaster/miniapp-sdk");
        const sdk = mod.sdk;
        sdkRef.current = sdk;
        try {
          await sdk.actions.ready();
        } catch {
          /* not in a host — fine */
        }
        let detected = false;
        try {
          detected = await sdk.isInMiniApp();
        } catch {
          detected = false;
        }
        let ctxUser: FcUser = null;
        try {
          const ctx = await sdk.context;
          if (ctx?.user?.fid) {
            ctxUser = {
              fid: ctx.user.fid,
              username: ctx.user.username ?? null,
              pfpUrl: ctx.user.pfpUrl ?? null,
            };
          }
        } catch {
          /* no context */
        }
        if (!alive) return;
        setInMini(detected);
        setUser(ctxUser);
      } catch {
        /* SDK unavailable (plain browser) — fall back to window.ethereum */
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const loadRecent = useCallback(async () => {
    try {
      const res = await fetch("/api/notes?limit=8", { cache: "no-store" });
      const j = await res.json();
      if (j?.ok) setRecent(j.notes ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  async function getProvider(): Promise<any | null> {
    const sdk = sdkRef.current;
    if (inMini && sdk?.wallet?.getEthereumProvider) {
      try {
        const p = await sdk.wallet.getEthereumProvider();
        if (p) return p;
      } catch {
        /* fall through */
      }
    }
    if (typeof window !== "undefined" && (window as any).ethereum) {
      return (window as any).ethereum;
    }
    return null;
  }

  async function sign() {
    setError(null);
    const text = body.trim();
    if (text.length < 1 || text.length > NOTE_MAX_BODY) {
      setError(`Write 1–${NOTE_MAX_BODY} characters.`);
      return;
    }
    setPhase("signing");
    try {
      const provider = await getProvider();
      if (!provider) {
        setError("No wallet available. Open this in the Base App / Farcaster, or a wallet browser.");
        setPhase("idle");
        return;
      }
      const accounts: string[] = await provider.request({ method: "eth_requestAccounts" });
      const address = (accounts?.[0] ?? "").toLowerCase();
      if (!/^0x[a-f0-9]{40}$/.test(address)) {
        setError("Could not read a wallet address.");
        setPhase("idle");
        return;
      }
      const ts = Date.now();
      const message = notePreimage({ address, ts, body: text });
      const signature: string = await provider.request({
        method: "personal_sign",
        params: [message, address],
      });

      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          address,
          body: text,
          ts,
          signature,
          fid: user?.fid ?? null,
          username: user?.username ?? null,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) {
        setError(j?.error ? `Could not save: ${j.error}` : "Could not save the note.");
        setPhase("idle");
        return;
      }
      setResult(j.note as SignedNote);
      setPhase("done");
      loadRecent();
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setError(/reject|denied|user/i.test(msg) ? "Signature cancelled." : msg);
      setPhase("idle");
    }
  }

  async function share() {
    if (!result) return;
    const url = `${origin()}/n/${result.id}`;
    const text = `${result.body}\n\nwallet-signed on Base · re-verifiable · sign your own 👇`;
    const sdk = sdkRef.current;
    if (inMini && sdk?.actions?.composeCast) {
      try {
        await sdk.actions.composeCast({ text, embeds: [url] });
        return;
      } catch {
        /* fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setError("Copied the cast + link to your clipboard.");
    } catch {
      window.open(url, "_blank");
    }
  }

  function reset() {
    setResult(null);
    setBody("");
    setPhase("idle");
    setError(null);
  }

  return (
    <div
      style={{ minHeight: "100dvh" }}
      className="bg-[var(--background)] text-[var(--foreground)] flex flex-col"
    >
      {/* header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-lg flex items-center justify-center font-extrabold text-white text-[15px] bg-gradient-to-br from-[#5b8def] to-[#8b5cf6]">
            S
          </div>
          <div className="font-display font-semibold tracking-tight">SIGNA</div>
        </div>
        {user ? (
          <div className="flex items-center gap-2 text-[12px] text-white/60">
            {user.pfpUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.pfpUrl} alt="" className="size-6 rounded-full" />
            ) : null}
            <span>{user.username ? `@${user.username}` : `fid ${user.fid}`}</span>
          </div>
        ) : null}
      </div>

      <div className="flex-1 px-5 pb-8 max-w-[560px] w-full mx-auto flex flex-col">
        {phase !== "done" ? (
          <>
            <h1 className="font-display text-[26px] leading-tight font-bold mt-3">
              Sign a message <span className="brand-text">on Base</span>
            </h1>
            <p className="text-muted text-[14px] mt-2 leading-relaxed">
              One tap, no account. Your wallet signature is the proof — anyone can re-verify who
              said it. This is the message layer, made simple.
            </p>

            <div className="glass rounded-2xl p-4 mt-5">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, NOTE_MAX_BODY + 20))}
                placeholder="say something, signed…"
                rows={4}
                disabled={phase === "signing"}
                className="w-full bg-transparent outline-none resize-none text-[17px] leading-relaxed placeholder:text-white/25"
              />
              <div className="flex items-center justify-between mt-2">
                <span
                  className={`text-[12px] ${body.length > NOTE_MAX_BODY ? "text-[var(--error)]" : "text-faint"}`}
                >
                  {body.length}/{NOTE_MAX_BODY}
                </span>
                <span className="text-[11px] text-faint">EIP-191 · {inMini ? "Base App wallet" : "your wallet"}</span>
              </div>
            </div>

            {error ? (
              <div className="mt-3 text-[13px] text-[var(--error)]">{error}</div>
            ) : null}

            <button
              onClick={sign}
              disabled={phase === "signing" || body.trim().length === 0}
              className="mt-4 h-12 rounded-xl font-semibold text-white text-[15px] bg-gradient-to-br from-[#5b8def] to-[#8b5cf6] disabled:opacity-40 transition-opacity"
            >
              {phase === "signing" ? "Signing…" : "Sign on Base"}
            </button>
          </>
        ) : (
          <div className="mt-3 flex flex-col">
            <div className="inline-flex self-start items-center gap-2 text-[12px] font-semibold tracking-wide text-[#5b8def] border border-[rgba(91,141,239,0.4)] rounded-full px-3 py-1">
              ✓ SIGNED ON BASE
            </div>
            <div className="glass rounded-2xl p-4 mt-4">
              <div className="text-[18px] leading-relaxed">{result?.body}</div>
              <div className="mt-3 pt-3 border-t border-white/[0.06] text-[12px] text-faint font-mono">
                {result ? shortAddr(result.address) : ""}
                {result?.username ? `  ·  @${result.username}` : ""}
              </div>
            </div>

            <button
              onClick={share}
              className="mt-4 h-12 rounded-xl font-semibold text-white text-[15px] bg-gradient-to-br from-[#5b8def] to-[#8b5cf6]"
            >
              {inMini ? "Share to feed" : "Copy cast + link"}
            </button>
            <a
              href={result ? `/n/${result.id}` : "#"}
              className="mt-2 h-11 rounded-xl flex items-center justify-center font-medium text-[14px] text-white/80 border border-white/10 hover:bg-white/[0.04]"
            >
              View receipt + verify
            </a>
            <button onClick={reset} className="mt-3 text-[13px] text-faint hover:text-white/70">
              Sign another
            </button>
            {error ? <div className="mt-3 text-[13px] text-[#a5c3ff]">{error}</div> : null}
          </div>
        )}

        {/* live wall */}
        <div className="mt-9">
          <div className="text-[11px] uppercase tracking-[0.16em] text-faint mb-3">
            latest signed on Base
          </div>
          <div className="flex flex-col gap-2">
            {recent.length === 0 ? (
              <div className="text-[13px] text-faint">
                {ready ? "be the first to sign." : "loading…"}
              </div>
            ) : (
              recent.map((n) => (
                <a
                  key={n.id}
                  href={`/n/${n.id}`}
                  className="glass rounded-xl px-3.5 py-3 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="text-[14px] leading-snug line-clamp-2">{n.body}</div>
                  <div className="mt-1.5 text-[11px] text-faint font-mono">
                    {n.username ? `@${n.username}` : shortAddr(n.address)}
                  </div>
                </a>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function origin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return "https://www.signaagent.xyz";
}
