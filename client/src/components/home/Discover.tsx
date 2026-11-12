"use client";

import { MarketTable } from "./MarketTable";
import { ForYou } from "./ForYou";

/** what needs you on top, pakts / tokens / positions table below */
export function Discover() {
  return (
    <main className="flex min-w-0 flex-1 flex-col gap-3">
      <ForYou />
      <MarketTable />
    </main>
  );
}
