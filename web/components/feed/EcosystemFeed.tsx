"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { FeedTimeline } from "./FeedTimeline";

type EcosystemFeedProps = {
  /** Visual + copy ID — also drives accent color */
  kind: "miroshark" | "gitlawb" | "bankr";
  /** Bot wallet address resolved server-side from env. Null when not configured. */
  botAddress: string | null;
  /** Project's marketing site */
  projectUrl: string;
  /** Project name as it should appear in the H1 */
  projectName: string;
  /** What the feed publishes, one line, plain language */
  tagline: string;
  /** Source-of-truth of the data being relayed, plain language */
  sourceLine: string;
  /** Short call-to-action shown when bot isn't configured yet */
  setupHint: string;
  /** Optional emoji prefix for the H1 */
  emoji?: string;
  /** Link to /holders/<TOKEN> for the ecosystem token, if any */
  holdersHref?: string;
};

const ACCENT: Record<
  EcosystemFeedProps["kind"],
  { bar: string; tag: string; pill: string }
> = {
  miroshark: {
    bar: "bg-cyan-400",
    tag: "text-cyan-300",
    pill: "border-cyan-400/30 text-cyan-200 bg-cyan-400/10",
  },
  gitlawb: {
    bar: "bg-emerald-400",
    tag: "text-emerald-300",
    pill: "border-emerald-400/30 text-emerald-200 bg-emerald-400/10",
  },
  bankr: {
    bar: "bg-violet-400",
    tag: "text-violet-300",
    pill: "border-violet-400/30 text-violet-200 bg-violet-400/10",
  },
};

export function EcosystemFeed(props: EcosystemFeedProps) {
  const colors = ACCENT[props.kind];

  return (
    <>
      <section className="border-b border-white/[0.06]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-10 pb-6">
          <Link
            href="/feed"
            className="text-xs text-white/45 hover:text-white inline-flex items-center gap-1 mb-6"
          >
            <ArrowLeft className="size-3" />
            Back to global feed
          </Link>
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-block size-1.5 rounded-full ${colors.bar}`} />
            <span className={`text-[10px] uppercase tracking-wider font-medium ${colors.tag}`}>
              Live · {props.projectName} bridge
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-[-0.03em] leading-tight">
            {props.emoji ? `${props.emoji} ` : ""}
            {props.projectName} on SIGNA
          </h1>
          <p className="text-white/65 max-w-lg mt-3 text-[14px] leading-relaxed">
            {props.tagline}
          </p>
          <p className="text-white/40 max-w-lg mt-2 text-[12px] leading-relaxed">
            Source: {props.sourceLine}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
            <a
              href={props.projectUrl}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 border ${colors.pill}`}
            >
              {props.projectName}
              <ArrowUpRight className="size-3" />
            </a>
            {props.holdersHref && (
              <Link
                href={props.holdersHref}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 border border-white/15 text-white/75 hover:bg-white/[0.04] transition"
              >
                holders
                <ArrowUpRight className="size-3" />
              </Link>
            )}
            {props.botAddress && (
              <span className="text-white/35 font-mono">
                bot: {props.botAddress.slice(0, 6)}…{props.botAddress.slice(-4)}
              </span>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
          {props.botAddress ? (
            <FeedTimeline authorFilter={props.botAddress.toLowerCase()} />
          ) : (
            <div className="card rounded-md p-5 text-[13px] text-white/65 leading-relaxed">
              <div className="text-[10px] uppercase tracking-wider text-white/45 mb-2 font-medium">
                Bridge not configured
              </div>
              {props.setupHint}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
