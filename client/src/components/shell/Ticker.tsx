"use client";

import Link from "next/link";

export const FAUCET = "https://near-faucet.io/";

const LINKS = [
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
] as const;

export function Ticker() {
  return (
    <footer className="flex h-7 shrink-0 items-center justify-between px-3.5 text-xs">
      <p className="text-text-3">Group vaults on NEAR · the pakter trades, never withdraws</p>
      <nav className="flex items-center">
        <span className="flex items-center gap-1.5 pr-3 font-bold text-up">
          <span className="size-1.5 rounded-full bg-up" />
          Testnet
        </span>
        {LINKS.map(([label, href], i) => (
          <Link key={href} href={href} className={`px-2 text-text-2 hover:text-text ${i === 0 ? "border-l pl-3" : ""}`}>
            {label}
          </Link>
        ))}
        <a href={FAUCET} target="_blank" rel="noopener noreferrer" className="px-2 text-text-2 hover:text-text">
          Faucet
        </a>
        <a href="https://x.com/paktdotfam/" target="_blank" rel="noopener noreferrer" aria-label="Pakt on X" className="px-2 text-text-2 hover:text-text">
          𝕏
        </a>
      </nav>
    </footer>
  );
}
