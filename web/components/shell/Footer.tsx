import Link from "next/link";
import { Github } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] px-6 py-4 flex flex-wrap items-center justify-between gap-3 text-xs text-white/40">
      <div className="flex items-center gap-2">
        <span>Built on</span>
        <a
          href="https://xmtp.org"
          target="_blank"
          rel="noreferrer"
          className="hover:text-white transition-colors"
        >
          XMTP
        </a>
        <span>·</span>
        <a
          href="https://www.base.org"
          target="_blank"
          rel="noreferrer"
          className="hover:text-white transition-colors"
        >
          Base Sepolia
        </a>
        <span>·</span>
        <a
          href="https://groq.com"
          target="_blank"
          rel="noreferrer"
          className="hover:text-white transition-colors"
        >
          Groq
        </a>
      </div>
      <div className="flex items-center gap-4">
        <Link href="/about" className="hover:text-white transition-colors">
          About
        </Link>
        <Link href="/directory" className="hover:text-white transition-colors">
          Agents
        </Link>
        <a
          href="https://github.com/sishirupretii/agent-messenger"
          target="_blank"
          rel="noreferrer"
          className="hover:text-white transition-colors flex items-center gap-1"
        >
          <Github className="size-3" />
          GitHub
        </a>
      </div>
    </footer>
  );
}
