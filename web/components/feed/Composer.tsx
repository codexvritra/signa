"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { useAccount, useSignMessage } from "wagmi";
import { toast } from "sonner";
import { buildMessageToSign, MAX_POST_LENGTH } from "@/lib/feed-types";
import { Spinner } from "@/components/ui/Spinner";
import { MentionAutocomplete } from "./MentionAutocomplete";

export function Composer({
  parentId,
  placeholder,
  autoFocus,
  onPosted,
}: {
  parentId?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onPosted?: () => void;
}) {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const ref = useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(
    null,
  );

  function updateMentionFromText(value: string, caret: number) {
    const before = value.slice(0, caret);
    const m = before.match(/(^|\s)@([a-zA-Z0-9_\-.]*)$/);
    if (m) {
      setMention({
        start: caret - m[2].length,
        query: m[2].toLowerCase(),
      });
    } else {
      setMention(null);
    }
  }

  function onChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setText(value);
    updateMentionFromText(value, e.target.selectionStart ?? value.length);
  }

  function insertMention(insert: string) {
    if (!mention) return;
    const before = text.slice(0, mention.start);
    const after = text.slice(mention.start + mention.query.length);
    const next = `${before}${insert} ${after}`;
    setText(next);
    setMention(null);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (el) {
        const pos = before.length + insert.length + 1;
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    });
  }

  async function submit() {
    if (busy) return;
    const content = text.trim();
    if (!content) return;
    if (!address) {
      toast.error("Connect your wallet first");
      return;
    }
    if (content.length > MAX_POST_LENGTH) {
      toast.error(`Too long (${content.length}/${MAX_POST_LENGTH})`);
      return;
    }
    setBusy(true);
    try {
      const ts = Date.now();
      const message = buildMessageToSign({
        kind: "post",
        content,
        parent_id: parentId ?? null,
        ts,
      });
      const signature = await signMessageAsync({ message });
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content,
          parent_id: parentId ?? null,
          ts,
          signature,
          author_address: address.toLowerCase(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Post failed");
        return;
      }
      setText("");
      onPosted?.();
      toast.success(parentId ? "Reply posted" : "Posted");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Post failed", { description: msg });
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (mention) return; // mention popover handles enter/arrows
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <div className="card rounded-md p-3 relative">
      <textarea
        ref={ref}
        value={text}
        onChange={onChange}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        rows={parentId ? 2 : 3}
        placeholder={
          placeholder ?? (parentId ? "Write a reply…" : "What's happening on-chain?")
        }
        className="w-full bg-transparent text-[14px] text-white resize-none outline-none placeholder:text-white/30 leading-relaxed"
        disabled={busy}
      />
      {mention && (
        <div className="absolute left-3 right-3 top-full mt-1 z-10">
          <MentionAutocomplete
            query={mention.query}
            onPick={insertMention}
            onClose={() => setMention(null)}
          />
        </div>
      )}
      <div className="mt-2 flex items-center justify-between">
        <div className="text-[10px] text-white/35">
          @ tag SIGNA users · ⌘/Ctrl+Enter to post
          <span className="ml-3">
            {text.length}/{MAX_POST_LENGTH}
          </span>
        </div>
        <button
          onClick={submit}
          disabled={busy || !text.trim() || !address}
          className="bg-white text-black text-xs font-medium rounded-md px-3 py-1 hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
        >
          {busy && <Spinner size={11} className="text-black" />}
          {parentId ? "Reply" : "Post"}
        </button>
      </div>
    </div>
  );
}
