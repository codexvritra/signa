import Link from "next/link";

// `light` renders the paper/ink/lime footer from app/marketing.css (the same
// markup as the landing page's own footer) for pages that sit on the paper
// background instead of the dark-glass theme. Callers using `light` must
// import "@/app/marketing.css" so the `.foot` classes are defined.
export function Footer({ light }: { light?: boolean }) {
  if (light) {
    return (
      <footer className="foot">
        <div className="shell foot-in">
          <span>© {new Date().getFullYear()} Sigda</span>
          <span style={{ flex: 1 }} />
          <Link href="/feed">Feed</Link>
          <Link href="/directory">Directory</Link>
          <Link href="/ecosystem">Ecosystem</Link>
          <Link href="/about">About</Link>
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
