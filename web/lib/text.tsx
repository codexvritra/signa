import { Fragment, type ReactNode } from "react";

// Order matters: try links first so URLs inside other markup don't break.
const URL_RE = /(https?:\/\/[^\s<>"']+)/g;
// Inline patterns: **bold**, *italic*, `code`
// Use a single combined regex with alternation, capturing the marker pair.
const INLINE_RE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;

type Span = { kind: "text" | "link" | "bold" | "italic" | "code"; value: string };

function splitLinks(text: string): Span[] {
  const out: Span[] = [];
  let last = 0;
  const re = new RegExp(URL_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ kind: "text", value: text.slice(last, m.index) });
    out.push({ kind: "link", value: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", value: text.slice(last) });
  return out;
}

function splitInline(text: string): Span[] {
  const out: Span[] = [];
  let last = 0;
  const re = new RegExp(INLINE_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ kind: "text", value: text.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith("**") && tok.endsWith("**") && tok.length > 4) {
      out.push({ kind: "bold", value: tok.slice(2, -2) });
    } else if (tok.startsWith("*") && tok.endsWith("*") && tok.length > 2) {
      out.push({ kind: "italic", value: tok.slice(1, -1) });
    } else if (tok.startsWith("`") && tok.endsWith("`") && tok.length > 2) {
      out.push({ kind: "code", value: tok.slice(1, -1) });
    } else {
      out.push({ kind: "text", value: tok });
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push({ kind: "text", value: text.slice(last) });
  return out;
}

function expand(spans: Span[]): Span[] {
  const out: Span[] = [];
  for (const s of spans) {
    if (s.kind === "text") {
      out.push(...splitInline(s.value));
    } else {
      out.push(s);
    }
  }
  return out;
}

/**
 * Parse plain text and turn http(s):// URLs into anchor tags + lightweight
 * markdown (**bold**, *italic*, `code`) into styled spans.
 */
export function renderTextWithLinks(text: string, isInverted = false): ReactNode {
  if (!text) return null;
  const spans = expand(splitLinks(text));
  return spans.map((s, idx) => {
    if (s.kind === "link") {
      return (
        <a
          key={idx}
          href={s.value}
          target="_blank"
          rel="noreferrer"
          className={
            isInverted
              ? "underline underline-offset-2 hover:opacity-80"
              : "text-violet-300 underline underline-offset-2 hover:text-violet-200"
          }
        >
          {s.value}
        </a>
      );
    }
    if (s.kind === "bold") {
      return (
        <strong key={idx} className="font-semibold">
          {s.value}
        </strong>
      );
    }
    if (s.kind === "italic") {
      return (
        <em key={idx} className="italic">
          {s.value}
        </em>
      );
    }
    if (s.kind === "code") {
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
    }
    return <Fragment key={idx}>{s.value}</Fragment>;
  });
}
