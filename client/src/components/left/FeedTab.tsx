"use client";

import { useState } from "react";
import { FilterIcon } from "@/components/ui/icons";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";
import { feed } from "@/lib/mock/feed";
import { me } from "@/lib/mock/me";
import type { FeedKind } from "@/lib/mock/types";
import { FeedRow } from "./feed/FeedRow";
import { RecapCard } from "./feed/RecapCard";

const SCOPES = ["All", "My pakts"] as const;
const GROUPS: Record<string, FeedKind[]> = {
  Trades: ["buy", "sell", "stoploss"],
  Votes: ["vote", "hired", "fired"],
  Members: ["joined", "left", "settled"],
};
const FILTERS = ["Everything", ...Object.keys(GROUPS)];

export function FeedTab() {
  const [scope, setScope] = useState<(typeof SCOPES)[number]>("All");
  const [filtering, setFiltering] = useState(false);
  const [filter, setFilter] = useState("Everything");

  const events = feed
    .filter((e) => scope === "All" || me.paktIds.includes(e.paktId))
    .filter((e) => GROUPS[filter]?.includes(e.kind) ?? true);

  return (
    <>
      <div className="flex items-center justify-between px-3 pt-1 pb-2">
        <Select label="Scope" options={SCOPES} value={scope} onChange={setScope} />
        <button
          type="button"
          aria-expanded={filtering}
          onClick={() => setFiltering(!filtering)}
          className={`flex items-center gap-1 text-sm ${filter === "Everything" ? "text-text-2" : "text-accent"} hover:text-text`}
        >
          <FilterIcon className="size-3.5" /> Filter
        </button>
      </div>
      {filtering && <Segmented options={FILTERS} value={filter} onChange={setFilter} className="px-3 pb-2" />}
      <div className="flex-1 overflow-y-auto">
        <RecapCard />
        <ul>
          {events.map((e) => (
            <FeedRow key={e.id} event={e} />
          ))}
        </ul>
      </div>
    </>
  );
}
