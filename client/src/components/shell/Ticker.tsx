"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { usd } from "@/lib/format";
import { loadTokens, useLoad } from "@/lib/home/data";

export const FAUCET = "https://near-faucet.io/";

const LINKS = [
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
] as const;

export function Ticker() {
  const { data } = useLoad(loadTokens, []);
  return (
    <footer className="flex h-7 shrink-0 items-center justify-between px-3.5 text-xs">
      <ul className="flex items-center gap-4">
        {data
          ? data.map((t) => (
              <li key={t.id}>
                <Link href={`/token/${t.symbol}`} className="flex items-center gap-1.5 hover:text-text-2">
                  <Avatar name={t.symbol} src={t.logo} size={14} />
                  {t.symbol} {t.price === null ? "—" : usd(t.price)}
                </Link>
              </li>
            ))
          : <li><Skeleton className="h-3.5 w-48" /></li>}
      </ul>
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
