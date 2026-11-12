"use client";

import { Suspense, useState } from "react";
import { Tabs } from "@/components/ui/Tabs";
import { Segmented } from "@/components/ui/Segmented";
import { AlertsTab } from "./AlertsTab";
import { FeedTab } from "./FeedTab";
import { LeaderboardTab } from "./LeaderboardTab";
import { PaktsTab } from "./PaktsTab";

const TABS = [
  { id: "pakts", label: "Pakts" },
  { id: "traders", label: "Traders" },
  { id: "activity", label: "Activity" },
] as const;
type Tab = (typeof TABS)[number]["id"];

function Activity() {
  const [view, setView] = useState<"Feed" | "For you">("Feed");
  return <>
    <Segmented options={["Feed", "For you"]} value={view} onChange={setView} className="m-3" />
    {view === "Feed" ? <FeedTab /> : <AlertsTab />}
  </>;
}

export function LeftPanel() {
  const [tab, setTab] = useState<Tab>("pakts");
  const [expanded, setExpanded] = useState(false);
  return (
    <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-2xl border bg-panel xl:w-[320px]">
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-3">
        <Tabs items={[...TABS]} value={tab} onChange={(next) => { setTab(next); setExpanded(true); }} />
        <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className="px-2 text-xs text-text-2 xl:hidden">
          {expanded ? "Hide" : "Show"}
        </button>
      </div>
      <div className={`${expanded ? "flex max-xl:h-64" : "hidden"} min-h-0 flex-1 flex-col xl:flex`}>
        <Suspense>
          {tab === "pakts" ? <PaktsTab /> : tab === "traders" ? <LeaderboardTab /> : <Activity />}
        </Suspense>
      </div>
      <p className="hidden border-t px-4 py-3 text-xs text-text-2 xl:block">Pool funds. Vote together. Trade within limits.</p>
    </aside>
  );
}
