"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { AppHeader } from "@/components/shell/AppHeader";
import { Footer } from "@/components/shell/Footer";

type Integration = {
  name: string;
  token: string | null;
  category: string;
  blurb: string;
  signaUses: string[];
  url: string;
  slash: string | null;
  contract?: string;
};

const INTEGRATIONS: Integration[] = [
  {
    name: "MiroShark",
    token: "$MIROSHARK",
    category: "Simulation",
    blurb:
      "AI multi-agent simulation infrastructure on Base. Spawn hundreds of agents to simulate public reaction across Twitter, Reddit, and prediction markets.",
    signaUses: [
      "Ask the SIGDA agent 'simulate reaction to X' — calls miroshark_simulate which POSTs to your MIROSHARK_BASE_URL instance (or returns deploy-your-own instructions)",
      "Tip with $MIROSHARK from the payment modal — verified Base contract 0xd7bc…ba3",
      "Holder chip on every profile that owns $MIROSHARK",
    ],
    url: "https://github.com/aaronjmars/MiroShark",
    slash: "/miroshark",
    contract: "0xd7bc6a05a56655fb2052f742b012d1dfd66e1ba3",
  },
];

export default function EcosystemPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1">
        <section className="border-b border-white/[0.06]">
          <div className="max-w-5xl mx-auto px-6 lg:px-10 pt-12 pb-12 sm:pt-16">
            <Link
              href="/"
              className="text-xs text-white/45 hover:text-white inline-flex items-center gap-1 mb-8"
            >
              <ArrowLeft className="size-3" />
              Back
            </Link>
            <div className="text-xs uppercase tracking-wider text-white/40 mb-3">
              Ecosystem
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-[-0.03em] leading-[1.05] max-w-2xl">
              The stack we&apos;re built on.
            </h1>
            <p className="text-white/55 max-w-xl mt-5 text-[16px] leading-relaxed">
              SIGDA is the messenger and the kernel. MiroShark is the
              simulation lab.
            </p>
          </div>
        </section>

        <section className="flex-1">
          <div className="max-w-5xl mx-auto px-6 lg:px-10 py-12 sm:py-16">
            <div className="grid sm:grid-cols-2 gap-4">
              {INTEGRATIONS.map((it) => (
                <a
                  key={it.name}
                  href={it.url}
                  target="_blank"
                  rel="noreferrer"
                  className="card rounded-md p-5 hover:bg-white/[0.03] transition-colors group flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
                        {it.category}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <h2 className="font-display text-xl font-semibold text-white">
                          {it.name}
                        </h2>
                        {it.token && (
                          <span className="text-[11px] text-[var(--accent)] font-mono">
                            {it.token}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowUpRight className="size-4 text-white/30 group-hover:text-white flex-shrink-0" />
                  </div>
                  <p className="text-[13px] text-white/60 leading-relaxed">
                    {it.blurb}
                  </p>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">
                      Uses in SIGDA
                    </div>
                    <ul className="text-[12px] text-white/70 space-y-1">
                      {it.signaUses.map((u) => (
                        <li
                          key={u}
                          className="pl-3 relative before:absolute before:left-0 before:top-[7px] before:size-1 before:rounded-full before:bg-[var(--accent)]/60"
                        >
                          {u}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {it.slash && (
                    <div className="mt-auto pt-2 flex items-center gap-2 text-[11px]">
                      <span className="font-mono bg-white/[0.05] rounded px-1.5 py-0.5 text-white/70">
                        {it.slash}
                      </span>
                      <span className="text-white/35">
                        Try it in any chat composer
                      </span>
                    </div>
                  )}
                </a>
              ))}
            </div>

            <div className="mt-12 card rounded-md p-5 text-[13px] text-white/60 leading-relaxed">
              <span className="text-[10px] uppercase tracking-wider text-white/40 block mb-2">
                Want to integrate?
              </span>
              If you&apos;re building something that touches messaging,
              agents, or payments, your project belongs on this page. Find
              SIGDA on{" "}
              <a
                href="/directory"
                className="text-[var(--accent)] underline underline-offset-2 hover:text-[var(--accent-2)]"
              >
                directory
              </a>
              .
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
