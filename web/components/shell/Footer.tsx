import Link from "next/link";
import { SIGNA } from "@/lib/token";
import { ContractBadge } from "@/components/shell/ContractBadge";

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06]">
      <div className="max-w-5xl mx-auto px-6 lg:px-10 py-5 flex flex-wrap items-center justify-between gap-x-5 gap-y-3 text-xs text-white/40">
        <div className="flex items-center gap-4">
          <span>© {new Date().getFullYear()} SIGNA</span>
          <a href={SIGNA.x.url} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
            {SIGNA.x.handle}
          </a>
        </div>
        <ContractBadge />
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
