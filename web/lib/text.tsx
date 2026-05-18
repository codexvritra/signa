import { Fragment, type ReactNode } from "react";

const URL_RE = /(https?:\/\/[^\s<>"']+)/g;

/**
 * Parse plain text and turn http(s):// URLs into anchor tags.
 * Returns a list of React nodes safe for direct rendering.
 */
export function renderTextWithLinks(text: string, isInverted = false): ReactNode {
  if (!text) return null;
  const parts = text.split(URL_RE);
  return parts.map((part, idx) => {
    if (URL_RE.test(part)) {
      // reset state of the regex
      URL_RE.lastIndex = 0;
      return (
        <a
          key={idx}
          href={part}
          target="_blank"
          rel="noreferrer"
          className={
            isInverted
              ? "underline underline-offset-2 hover:opacity-80"
              : "text-violet-300 underline underline-offset-2 hover:text-violet-200"
          }
        >
          {part}
        </a>
      );
    }
    return <Fragment key={idx}>{part}</Fragment>;
  });
}
