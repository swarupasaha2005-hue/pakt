"use client";

import { MarketTable } from "./MarketTable";
import { PinStrip } from "./PinStrip";

/** token strip on top, pakts / tokens / positions table below */
export function Discover() {
  return (
    <main className="flex min-w-0 flex-1 flex-col gap-3">
      <PinStrip />
      <MarketTable />
    </main>
  );
}
