"use client";

import { Suspense, useState } from "react";
import { BellIcon, ChevronsLeftIcon, SplitBottomIcon, SplitRightIcon, StarIcon } from "@/components/ui/icons";
import { Tabs } from "@/components/ui/Tabs";
import { AlertsTab } from "./AlertsTab";
import { FeedTab } from "./FeedTab";
import { LeaderboardTab } from "./LeaderboardTab";
import { PaktsTab } from "./PaktsTab";
import { StarredTab } from "./StarredTab";
import { TokensTab } from "./TokensTab";

const TABS = [
  { id: "alerts", label: <><BellIcon className="size-[18px]" /><span className="sr-only">Alerts</span></>, body: <AlertsTab /> },
  { id: "starred", label: <><StarIcon className="size-[18px]" /><span className="sr-only">Starred</span></>, body: <StarredTab /> },
  { id: "tokens", label: "Tokens", body: <TokensTab /> },
  { id: "pakts", label: "Pakts", body: <PaktsTab /> },
  { id: "leaderboard", label: "Leaderboard", body: <LeaderboardTab /> },
  { id: "feed", label: "Feed", body: <FeedTab /> },
] as const;

type TabId = (typeof TABS)[number]["id"];

const splitButton = "flex h-[26px] items-center justify-center gap-1.5 rounded-lg border bg-panel-2 text-xs text-text-3";

export function LeftPanel() {
  const [tab, setTab] = useState<TabId>("tokens");
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <button
        type="button"
        aria-label="Expand panel"
        onClick={() => setCollapsed(false)}
        className="flex size-[33px] shrink-0 items-center justify-center rounded-lg border bg-panel text-text-2 hover:text-text"
      >
        <ChevronsLeftIcon className="size-[18px] rotate-180" />
      </button>
    );
  }

  return (
    <aside className="flex w-[366px] shrink-0 flex-col overflow-hidden rounded-xl border bg-panel">
      <div className="flex h-9 shrink-0 items-center justify-between bg-panel-2 pr-2 pl-1.5 text-sm">
        <Tabs items={[...TABS]} value={tab} onChange={setTab} className="h-[18px]" />
        <button type="button" aria-label="Collapse panel" onClick={() => setCollapsed(true)} className="text-text-2 hover:text-text">
          <ChevronsLeftIcon className="size-5" />
        </button>
      </div>
      {/* why: usePathname in tabs suspends on unprerendered dynamic routes */}
      <div className="flex min-h-0 flex-1 flex-col">
        <Suspense>{TABS.find((t) => t.id === tab)?.body}</Suspense>
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-2 p-2">
        <button type="button" className={splitButton}>
          <SplitBottomIcon className="size-3.5" /> Split bottom
        </button>
        <button type="button" className={splitButton}>
          <SplitRightIcon className="size-3.5" /> Split right
        </button>
      </div>
    </aside>
  );
}
