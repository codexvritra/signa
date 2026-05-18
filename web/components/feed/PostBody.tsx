import { Fragment } from "react";
import Link from "next/link";
import { TOKENS } from "@/lib/tokens";

// Combined matcher: @mention | $SYMBOL | URL. We process in one pass so
// the same text doesn't get split twice and tokens inside a URL don't
// accidentally tag.
const MENTION_RE = /@[a-z0-9_\-.]+(?:\.eth)?|@0x[a-fA-F0-9]{40}/gi;
const URL_RE = /https?:\/\/[^\s<>"']+/g;
// $SYMBOL = $ followed by 2-10 uppercase-letters-or-digits. Word
// boundary on the left so prices like "$5" don't match (need ≥2 chars
// AND at least one letter).
const CASHTAG_RE = /\$([A-Z][A-Z0-9]{1,9})\b/g;

const COMBINED_RE = new RegExp(
  `(${URL_RE.source})|(${MENTION_RE.source})|(${CASHTAG_RE.source})`,
  "gi",
);

const KNOWN_TOKENS = new Map(
  TOKENS.filter((t) => t.address).map((t) => [
    t.symbol.toUpperCase(),
    {
      address: t.address!.toLowerCase(),
      project: t.project,
    },
  ]),
);

/**
 * Render a feed post body with:
 *   - URLs linked (external)
 *   - @mentions linked to /u/<handle> (rich profile page)
 *   - $SYMBOL cashtags linked to /tokens/<address> when we know the
 *     token. SIGNA's tracked partner tokens (BNKR / GITLAWB / MIROSHARK /
 *     USDC / etc.) render with the brand-accent treatment. Unknown
 *     symbols stay as plain text (no fake link to a missing page).
 */
export function PostBody({ text }: { text: string }) {
  if (!text) return null;

  const out: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  const matches = Array.from(text.matchAll(COMBINED_RE));

  for (const m of matches) {
    const start = m.index ?? 0;
    if (start > cursor) {
      out.push(
        <Fragment key={`t${key++}`}>{text.slice(cursor, start)}</Fragment>,
      );
    }
    const full = m[0];
    if (m[1]) {
      // URL
      out.push(
        <a
          key={`u${key++}`}
          href={full}
          target="_blank"
          rel="noreferrer"
          className="text-[var(--accent)] underline underline-offset-2 hover:text-[var(--accent-2)]"
        >
          {full}
        </a>,
      );
    } else if (m[2]) {
      // @mention
      const handle = full.slice(1);
      out.push(
        <Link
          key={`m${key++}`}
          href={`/u/${encodeURIComponent(handle.toLowerCase())}`}
          className="text-[var(--accent)] hover:text-[var(--accent-2)] font-medium"
        >
          {full}
        </Link>,
      );
    } else if (m[3]) {
      // $SYMBOL — m[4] is the symbol without the $
      const symbol = (m[4] ?? "").toUpperCase();
      const known = KNOWN_TOKENS.get(symbol);
      if (known) {
        out.push(
          <Link
            key={`c${key++}`}
            href={`/tokens/${known.address}`}
            className="inline-flex items-center gap-0.5 text-[var(--accent)] hover:text-[var(--accent-2)] font-mono font-medium px-1 -mx-0.5 rounded-sm hover:bg-white/[0.04] transition-colors"
            title={`Open $${symbol} on SIGNA`}
          >
            ${symbol}
          </Link>,
        );
      } else {
        out.push(<Fragment key={`c${key++}`}>{full}</Fragment>);
      }
    }
    cursor = start + full.length;
  }
  if (cursor < text.length) {
    out.push(<Fragment key={`t${key++}`}>{text.slice(cursor)}</Fragment>);
  }

  return <div className="whitespace-pre-wrap break-words">{out}</div>;
}
