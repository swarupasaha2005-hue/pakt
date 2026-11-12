"use client";

import { useState } from "react";
import { RightPanel } from "@/components/shell/RightPanel";
import { ChevronsLeftIcon } from "@/components/ui/icons";
import { MarketTable } from "./MarketTable";
import { PinStrip } from "./PinStrip";
import { Positions } from "./Positions";

/** §18: pin strip on top, market table + collapsible positions below */
export function Discover() {
  const [starred, setStarred] = useState<string[]>([]);
  const [positionsOpen, setPositionsOpen] = useState(true);
  const toggleStar = (symbol: string) =>
    setStarred((s) => (s.includes(symbol) ? s.filter((x) => x !== symbol) : [...s, symbol]));

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-3">
      <PinStrip starred={starred} />
      <div className="flex min-h-0 flex-1 gap-3">
        <MarketTable starred={starred} onStar={toggleStar} />
        {positionsOpen ? (
          <RightPanel>
            <Positions onCollapse={() => setPositionsOpen(false)} />
          </RightPanel>
        ) : (
          <aside className="flex w-12 shrink-0 justify-center rounded-2xl border bg-panel pt-2.5">
            <button type="button" aria-label="Show positions" onClick={() => setPositionsOpen(true)} className="h-fit text-text-2 hover:text-text">
              <ChevronsLeftIcon className="size-5" />
            </button>
          </aside>
        )}
      </div>
    </main>
  );
}
