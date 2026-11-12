"use client";

import { useState } from "react";
import { FilterIcon, MuteIcon, VolumeIcon } from "@/components/ui/icons";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { alerts } from "@/lib/api";
import { loadTokens, useLoad, useNow } from "@/lib/home/data";
import { AlertCard } from "./alerts/AlertCard";

const SIDES = ["All", "Buy", "Sell"] as const;
const WINDOWS = ["1h", "24h", "7d", "30d"] as const;
const toggle = "flex items-center gap-1.5 text-xs transition-colors hover:text-text";

export function AlertsTab() {
  const [filtering, setFiltering] = useState(false);
  const [side, setSide] = useState<(typeof SIDES)[number]>("All");
  const [win, setWin] = useState<(typeof WINDOWS)[number]>("24h");
  // shortcut: toggle only, no audio yet
  const [sound, setSound] = useState(true);
  const { data, error } = useLoad(() => alerts({ window: win, limit: 100 }), [win]);
  const tokens = useLoad(loadTokens, []);
  const now = useNow();

  const shown = data?.items.filter((a) => side === "All" || a.side === side.toLowerCase()) ?? [];

  return (
    <>
      <div className="flex items-center gap-4 px-3 pt-2.5 pb-3">
        <Segmented options={WINDOWS} value={win} onChange={setWin} />
        <button type="button" aria-expanded={filtering} onClick={() => setFiltering(!filtering)} className={`${toggle} ${side === "All" ? "text-text-2" : "text-text"}`}>
          <FilterIcon className="size-3.5" /> Filters{side !== "All" && " (1)"}
        </button>
        <button type="button" aria-label={sound ? "Mute alerts" : "Unmute alerts"} onClick={() => setSound(!sound)} className="ml-auto text-text-2 hover:text-text">
          {sound ? <VolumeIcon className="size-4" /> : <MuteIcon className="size-4" />}
        </button>
      </div>
      {filtering && <Segmented options={SIDES} value={side} onChange={setSide} className="px-3 pb-2" />}
      <ul className="flex-1 overflow-y-auto">
        {!data && !error && [0, 1].map((i) => <li key={i} className="px-3 py-2"><Skeleton className="h-24" /></li>)}
        {error && <li className="py-10 text-center text-sm text-text-2">Could not load alerts</li>}
        {data && !shown.length && <li className="py-10 text-center text-sm text-text-2">No alerts in the last {win}. Alerts fire when 2+ traders hit the same token and side.</li>}
        {shown.map((a) => (
          <AlertCard key={`${a.token}-${a.side}-${a.first_at}`} alert={a} token={tokens.data?.find((t) => t.id === a.token)} now={now} />
        ))}
      </ul>
    </>
  );
}
