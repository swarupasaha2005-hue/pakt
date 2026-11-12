"use client";

import { useState } from "react";
import { FilterIcon } from "@/components/ui/icons";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { feed, type EventKind, type PaktEvent } from "@/lib/api";
import { loadHoldings, useLoad, useNow } from "@/lib/home/data";
import { useWallet } from "@/lib/near/wallet";
import { useStream } from "@/lib/stream";
import { FeedRow, SHOWN } from "./feed/FeedRow";

const SCOPES = ["All", "My pakts"] as const;
const GROUPS: Record<string, EventKind[]> = {
  Trades: ["trade", "paused", "resumed"],
  Trader: ["offer", "hired", "declined", "fired", "fire_pending", "cap_set"],
  Members: ["pakt_created", "deposit", "leave", "settled", "claim"],
};
const FILTERS = ["Everything", ...Object.keys(GROUPS)];

export function FeedTab() {
  const { accountId } = useWallet();
  const [scope, setScope] = useState<(typeof SCOPES)[number]>("All");
  const [filtering, setFiltering] = useState(false);
  const [filter, setFilter] = useState("Everything");
  const now = useNow();
  const [live, setLive] = useState<PaktEvent[]>([]);
  const { data, error } = useLoad(() => feed({ limit: 100 }), []);
  const mine = useLoad(accountId ? () => loadHoldings(accountId) : null, [accountId]);
  useStream((e) => setLive((l) => (l.some((x) => x.id === e.id) ? l : [e, ...l])));

  const myVaults = mine.data?.map((h) => h.pakt.vault) ?? [];
  const seen = new Set<number>();
  const events = [...live, ...(data?.items ?? [])]
    .filter((e) => !seen.has(e.id) && seen.add(e.id) && SHOWN.includes(e.kind))
    .filter((e) => scope === "All" || !accountId || myVaults.includes(e.vault))
    .filter((e) => GROUPS[filter]?.includes(e.kind) ?? true);

  return (
    <>
      <div className="flex items-center justify-between px-3 pt-1 pb-2">
        {accountId ? <Select label="Scope" options={SCOPES} value={scope} onChange={setScope} /> : <span />}
        <button
          type="button"
          aria-expanded={filtering}
          onClick={() => setFiltering(!filtering)}
          className={`flex items-center gap-1 text-xs ${filter === "Everything" ? "text-text-2" : "text-accent"} hover:text-text`}
        >
          <FilterIcon className="size-3.5" /> Filter
        </button>
      </div>
      {filtering && <Segmented options={FILTERS} value={filter} onChange={setFilter} className="px-3 pb-2" />}
      <div className="flex-1 overflow-y-auto">
        {!data && !error && (
          <div className="space-y-2 px-3 py-2">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}
          </div>
        )}
        {error && <p className="py-10 text-center text-sm text-text-2">Could not load the feed</p>}
        {data && !events.length && <p className="py-10 text-center text-sm text-text-2">No activity yet</p>}
        <ul>
          {events.map((e) => (
            <FeedRow key={e.id} event={e} now={now} />
          ))}
        </ul>
      </div>
    </>
  );
}
