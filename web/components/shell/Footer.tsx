import Link from "next/link";

// `light` renders the near-black/mono footer from app/marketing.css (the
// 9e9.world-style `.foot` rules) for the public product pages that sit on
// that dark surface instead of the dark-glass app theme. Callers using
// `light` must import "@/app/marketing.css" so the `.foot` classes are defined.
export function Footer({ light }: { light?: boolean }) {
  if (light) {
    return (
      <footer className="foot">
        <div className="shell" style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-faint)", marginBottom: 14 }}>
          every number on this site is re-verifiable. nothing here is staged.
        </div>
        <div className="shell foot-in">
          <span>© {new Date().getFullYear()} Sigda</span>
          <span style={{ flex: 1 }} />
          <Link href="/feed">/feed</Link>
          <Link href="/directory">/directory</Link>
          <Link href="/ecosystem">/ecosystem</Link>
          <Link href="/about">/about</Link>
        </div>
        <div className="shell" style={{ marginTop: 14 }}>
          <p className="foot-disc">Sigda is non-custodial software. Nothing here is financial advice.</p>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-white/[0.06]">
      <div className="max-w-5xl mx-auto px-6 lg:px-10 py-5 flex flex-wrap items-center justify-between gap-x-5 gap-y-3 text-xs text-white/40">
        <div className="flex items-center gap-4">
          <span>© {new Date().getFullYear()} Sigda</span>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/feed" className="hover:text-white transition-colors">
            Feed
          </Link>
          <Link href="/directory" className="hover:text-white transition-colors">
            Directory
          </Link>
          <Link href="/ecosystem" className="hover:text-white transition-colors">
            Ecosystem
          </Link>
          <Link href="/about" className="hover:text-white transition-colors">
            About
          </Link>
        </div>
      </div>
    </footer>
  );
}
