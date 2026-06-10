import type { ReactNode } from "react";
import { DocsNav } from "./DocsNav";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-[1080px] mx-auto px-5 py-10 sm:py-14">
        <div className="text-[12px] uppercase tracking-[0.18em] text-faint mb-6">developer docs · everything here is live</div>
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          <aside className="lg:w-[200px] shrink-0 lg:sticky lg:top-20 lg:self-start">
            <DocsNav />
          </aside>
          <main className="min-w-0 flex-1 max-w-[760px]">{children}</main>
        </div>
      </div>
    </div>
  );
}
