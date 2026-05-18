import { Fragment, type ReactNode } from "react";
import { explorerAddress, explorerTx } from "./chain-links";

// Match order: URLs, then 0x tx hashes (66 chars), then 0x addresses (42 chars).
// Use lookaround to avoid matching addresses inside URLs.
const URL_RE = /(https?:\/\/[^\s<>"']+)/g;
const TX_HASH_RE = /\b(0x[a-fA-F0-9]{64})\b/g;
const ADDRESS_RE = /\b(0x[a-fA-F0-9]{40})\b/g;
const INLINE_RE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;

type Span =
  | { kind: "text"; value: string }
  | { kind: "link"; value: string }
  | { kind: "tx"; value: string }
  | { kind: "address"; value: string }
  | { kind: "bold"; value: string }
  | { kind: "italic"; value: string }
  | { kind: "code"; value: string };

function splitByRegex(
  text: string,
  re: RegExp,
  kind: Span["kind"],
): Span[] {
  const out: Span[] = [];
  let last = 0;
  const r = new RegExp(re.source, "g");
  let m: RegExpExecArray | null;
  while ((m = r.exec(text)) !== null) {
    if (m.index > last) out.push({ kind: "text", value: text.slice(last, m.index) });
    out.push({ kind, value: m[0] } as Span);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", value: text.slice(last) });
  return out;
}

function expandWith(
  spans: Span[],
  re: RegExp,
  kind: Span["kind"],
): Span[] {
  const out: Span[] = [];
  for (const s of spans) {
    if (s.kind === "text") {
      out.push(...splitByRegex(s.value, re, kind));
    } else {
      out.push(s);
    }
  }
  return out;
}

function expandInline(spans: Span[]): Span[] {
  const out: Span[] = [];
  for (const s of spans) {
    if (s.kind !== "text") {
      out.push(s);
      continue;
    }
    const parts = splitByRegex(s.value, INLINE_RE, "text");
    // After splitByRegex with "text" kind, all parts are text. We need to
    // recognize markdown markers manually.
    for (const p of parts) {
      const v = p.value;
      if (v.startsWith("**") && v.endsWith("**") && v.length > 4) {
        out.push({ kind: "bold", value: v.slice(2, -2) });
      } else if (v.startsWith("*") && v.endsWith("*") && v.length > 2) {
        out.push({ kind: "italic", value: v.slice(1, -1) });
      } else if (v.startsWith("`") && v.endsWith("`") && v.length > 2) {
        out.push({ kind: "code", value: v.slice(1, -1) });
      } else {
        out.push({ kind: "text", value: v });
      }
    }
  }
  return out;
}

function shortHash(s: string, head = 8, tail = 6): string {
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

/**
 * Parse text into rich spans: URLs, tx hashes, addresses (linked to
 * Basescan), and lightweight markdown (**bold**, *italic*, `code`).
 */
export function renderTextWithLinks(text: string, isInverted = false): ReactNode {
  if (!text) return null;
  let spans: Span[] = [{ kind: "text", value: text }];
  spans = expandWith(spans, URL_RE, "link");
  spans = expandWith(spans, TX_HASH_RE, "tx");
  spans = expandWith(spans, ADDRESS_RE, "address");
  spans = expandInline(spans);

  const linkClass = isInverted
    ? "underline underline-offset-2 hover:opacity-80"
    : "text-violet-300 underline underline-offset-2 hover:text-violet-200";

  return spans.map((s, idx) => {
    switch (s.kind) {
      case "link":
        return (
          <a
            key={idx}
            href={s.value}
            target="_blank"
            rel="noreferrer"
            className={linkClass}
          >
            {s.value}
          </a>
        );
      case "tx":
        return (
          <a
            key={idx}
            href={explorerTx(s.value)}
            target="_blank"
            rel="noreferrer"
            className={`${linkClass} font-mono`}
            title={`View tx on Basescan`}
          >
            {shortHash(s.value)}
          </a>
        );
      case "address":
        return (
          <a
            key={idx}
            href={explorerAddress(s.value)}
            target="_blank"
            rel="noreferrer"
            className={`${linkClass} font-mono`}
            title={`View address on Basescan`}
          >
            {shortHash(s.value, 6, 4)}
          </a>
        );
      case "bold":
        return (
          <strong key={idx} className="font-semibold">
            {s.value}
          </strong>
        );
      case "italic":
        return (
          <em key={idx} className="italic">
            {s.value}
          </em>
        );
      case "code":
        return (
          <code
            key={idx}
            className={
              isInverted
                ? "rounded bg-black/10 px-1 py-0.5 font-mono text-[12px]"
                : "rounded bg-white/10 px-1 py-0.5 font-mono text-[12px]"
            }
          >
            {s.value}
          </code>
        );
      default:
        return <Fragment key={idx}>{s.value}</Fragment>;
    }
  });
}
