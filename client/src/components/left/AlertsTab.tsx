"use client";

import { useState } from "react";
import { FilterIcon, MuteIcon, UsersIcon, VolumeIcon } from "@/components/ui/icons";
import { Segmented } from "@/components/ui/Segmented";
import { alerts } from "@/lib/mock/alerts";
import { tokens } from "@/lib/mock/tokens";
import { AlertCard } from "./alerts/AlertCard";

const SIDES = ["All", "Buy", "Sell"] as const;
const toggle = "flex items-center gap-1.5 text-sm transition-colors hover:text-text";

export function AlertsTab() {
  const [following, setFollowing] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [side, setSide] = useState<(typeof SIDES)[number]>("All");
  // shortcut: toggle only, no audio until alerts go live
  const [sound, setSound] = useState(true);

  const shown = alerts.filter(
    (a) => (!following || a.following) && (side === "All" || a.side === side.toLowerCase()),
  );

  return (
    <>
      <div className="flex items-center gap-4 px-3 pt-1 pb-2">
        <button type="button" aria-pressed={following} onClick={() => setFollowing(!following)} className={`${toggle} ${following ? "text-text" : "text-text-2"}`}>
          <UsersIcon className="size-4" /> Traders
        </button>
        <button type="button" aria-expanded={filtering} onClick={() => setFiltering(!filtering)} className={`${toggle} ${side === "All" ? "text-text-2" : "text-text"}`}>
          <FilterIcon className="size-3.5" /> Filters{side !== "All" && " (1)"}
        </button>
        <button type="button" aria-label={sound ? "Mute alerts" : "Unmute alerts"} onClick={() => setSound(!sound)} className="ml-auto text-text-2 hover:text-text">
          {sound ? <VolumeIcon className="size-4" /> : <MuteIcon className="size-4" />}
        </button>
      </div>
      {filtering && <Segmented options={SIDES} value={side} onChange={setSide} className="px-3 pb-2" />}
      <ul className="flex-1 overflow-y-auto">
        {shown.map((a) => (
          <AlertCard key={a.id} alert={a} token={tokens.find((t) => t.symbol === a.symbol)!} />
        ))}
      </ul>
    </>
  );
}
