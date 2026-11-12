"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function DiscoverLink() {
  const active = usePathname() === "/";
  return (
    <Link href="/" className={`text-base font-medium transition-colors ${active ? "text-text" : "text-text-2 hover:text-text"}`}>
      Explore
    </Link>
  );
}
