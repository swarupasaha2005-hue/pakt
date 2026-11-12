"use client";

import { useState } from "react";
import { RightPanel } from "@/components/shell/RightPanel";
import { ChevronsLeftIcon } from "@/components/ui/icons";
import { MarketTable } from "./MarketTable";
import { PinStrip } from "./PinStrip";
import { Positions } from "./Positions";

/** token strip on top, pakts/tokens table + collapsible positions below */
export function Discover() {
  const [positionsOpen, setPositionsOpen] = useState(true);

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-3">
      <PinStrip />
      <div className="flex min-h-0 flex-1 gap-3">
        <MarketTable />
        {positionsOpen ? (
          <RightPanel>
            <Positions onCollapse={() => setPositionsOpen(false)} />
          </RightPanel>
        ) : (
          <aside className="flex w-12 shrink-0 justify-center rounded-xl border bg-panel pt-2.5">
            <button type="button" aria-label="Show positions" onClick={() => setPositionsOpen(true)} className="h-fit text-text-2 hover:text-text">
              <ChevronsLeftIcon className="size-5" />
            </button>
          </aside>
        )}
      </div>
    </main>
  );
}
