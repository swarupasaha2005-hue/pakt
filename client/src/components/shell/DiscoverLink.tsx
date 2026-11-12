"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function DiscoverLink() {
  const active = usePathname() === "/";
  return (
    <Link href="/" className={`text-[17px] font-medium transition-colors ${active ? "text-text" : "text-text-2 hover:text-text"}`}>
      Discover
    </Link>
  );
}
