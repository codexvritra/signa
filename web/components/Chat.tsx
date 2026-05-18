"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import {
  Client,
  type DecodedMessage,
  type Dm,
} from "@xmtp/browser-sdk";
import { buildXmtpSigner, ethIdentifier, XMTP_ENV } from "@/lib/xmtp";

type InitStatus = "idle" | "loading" | "ready" | "error";

export function Chat() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [client, setClient] = useState<Awaited<
    ReturnType<typeof Client.create>
  > | null>(null);
  const [initStatus, setInitStatus] = useState<InitStatus>("idle");
  const [initError, setInitError] = useState<string | null>(null);

  const [peerInput, setPeerInput] = useState("");
  const [activeDm, setActiveDm] = useState<Dm | null>(null);
  const [messages, setMessages] = useState<DecodedMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [peerError, setPeerError] = useState<string | null>(null);
  const [openingDm, setOpeningDm] = useState(false);

  const activeDmRef = useRef<Dm | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeDmRef.current = activeDm;
  }, [activeDm]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function initXmtp() {
    if (!address || !walletClient) return;
    setInitStatus("loading");
    setInitError(null);
    try {
      const signer = buildXmtpSigner(walletClient, address);
      // ClientOptions is a discriminated union that TS can't narrow from a
      // plain object literal, so cast to the create() param type.
      const opts = { env: XMTP_ENV } as Parameters<typeof Client.create>[1];
      const xmtp = await Client.create(signer, opts);
      await xmtp.conversations.sync();
      setClient(xmtp);
      setInitStatus("ready");
    } catch (e) {
      setInitStatus("error");
      setInitError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    let stopStream: (() => void) | null = null;

    (async () => {
      try {
        const stream = await client.conversations.streamAllMessages({
          onValue: async (msg) => {
            if (cancelled || !msg) return;
            const dm = activeDmRef.current;
            if (!dm) return;
            if (msg.conversationId === dm.id) {
              const fresh = await dm.messages();
              setMessages(fresh);
            }
          },
          onError: (err) => {
            console.error("XMTP stream error", err);
          },
        });
        stopStream = () => {
          stream.end().catch(() => {});
        };
      } catch (e) {
        console.error("Failed to start XMTP stream", e);
      }
    })();

    return () => {
      cancelled = true;
      stopStream?.();
    };
  }, [client]);

  async function openConversation() {
    if (!client) return;
    setPeerError(null);
    const trimmed = peerInput.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      setPeerError("Enter a valid Ethereum address (0x… 40 hex chars).");
      return;
    }
    if (trimmed.toLowerCase() === address?.toLowerCase()) {
      setPeerError(
        "Can't message yourself from the same wallet. Use a second wallet.",
      );
      return;
    }

    setOpeningDm(true);
    setMessages([]);
    setActiveDm(null);
    try {
      const peerId = ethIdentifier(trimmed);
      const reach = await Client.canMessage([peerId], XMTP_ENV);
      const reachable = reach.get(trimmed.toLowerCase()) ?? false;
      if (!reachable) {
        setPeerError(
          "That address hasn't enabled XMTP yet. Have them open this app and click \"Enable XMTP messaging\" first.",
        );
        return;
      }
      const dm = await client.conversations.createDmWithIdentifier(peerId);
      await dm.sync();
      const msgs = await dm.messages();
      setActiveDm(dm);
      setMessages(msgs);
    } catch (e) {
      setPeerError(e instanceof Error ? e.message : String(e));
    } finally {
      setOpeningDm(false);
    }
  }

  async function send() {
    const dm = activeDm;
    const text = draft.trim();
    if (!dm || !text) return;
    setSending(true);
    try {
      await dm.sendText(text);
      setDraft("");
      const fresh = await dm.messages();
      setMessages(fresh);
    } catch (e) {
      console.error("Send failed", e);
    } finally {
      setSending(false);
    }
  }

  if (initStatus !== "ready" || !client) {
    return (
      <div className="w-full max-w-md flex flex-col gap-3">
        <button
          onClick={initXmtp}
          disabled={initStatus === "loading" || !walletClient}
          className="w-full rounded-md bg-white text-black font-medium px-4 py-2.5 hover:bg-neutral-200 transition disabled:opacity-50"
        >
          {initStatus === "loading"
            ? "Setting up XMTP… (sign in your wallet)"
            : "Enable XMTP messaging"}
        </button>
        <p className="text-xs text-neutral-500 text-center">
          One-time signature derives your XMTP identity. No gas. Can take ~10–30s the first time.
        </p>
        {initError && (
          <p className="text-xs text-red-400 break-words">{initError}</p>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-md flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Recipient address (0x…)"
          value={peerInput}
          onChange={(e) => setPeerInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") openConversation();
          }}
          className="flex-1 rounded-md bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm font-mono focus:outline-none focus:border-neutral-600"
        />
        <button
          onClick={openConversation}
          disabled={openingDm}
          className="rounded-md bg-white text-black px-3 py-2 text-sm font-medium hover:bg-neutral-200 transition disabled:opacity-50"
        >
          {openingDm ? "…" : "Open"}
        </button>
      </div>
      {peerError && <p className="text-xs text-red-400 break-words">{peerError}</p>}

      {activeDm && (
        <>
          <div
            ref={scrollRef}
            className="h-96 overflow-y-auto rounded-md border border-neutral-800 bg-neutral-950 p-3 flex flex-col gap-2"
          >
            {messages.length === 0 && (
              <p className="text-xs text-neutral-500 text-center my-auto">
                No messages yet. Say hi.
              </p>
            )}
            {messages.map((m) => (
              <Message
                key={m.id}
                message={m}
                isMine={m.senderInboxId === client.inboxId}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Type a message…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              disabled={sending}
              className="flex-1 rounded-md bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm focus:outline-none focus:border-neutral-600 disabled:opacity-50"
            />
            <button
              onClick={send}
              disabled={sending || !draft.trim()}
              className="rounded-md bg-white text-black px-4 py-2 text-sm font-medium hover:bg-neutral-200 transition disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Message({
  message,
  isMine,
}: {
  message: DecodedMessage;
  isMine: boolean;
}) {
  const content =
    typeof message.content === "string" ? message.content : "";
  if (!content) return null;
  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm break-words ${
          isMine
            ? "bg-white text-black"
            : "bg-neutral-800 text-neutral-100"
        }`}
      >
        {content}
      </div>
    </div>
  );
}
