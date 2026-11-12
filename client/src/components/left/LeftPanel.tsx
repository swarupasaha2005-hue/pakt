"use client";

import { Suspense, useEffect, useState } from "react";
import { BellIcon, ChevronsLeftIcon, StarIcon } from "@/components/ui/icons";
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


export function LeftPanel() {
  const [tab, setTab] = useState<TabId>("feed");
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    // the site tour switches tabs to show each one
    const show = (e: Event) => {
      setTab((e as CustomEvent<TabId>).detail);
      setCollapsed(false);
    };
    window.addEventListener("pakt:tab", show);
    return () => window.removeEventListener("pakt:tab", show);
  }, []);

  // stays mounted so width can animate; collapsed = 33px rail with the expand button
  return (
    <aside
      data-tour="left"
      className={`relative flex shrink-0 flex-col overflow-hidden transition-[width,border-radius] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none ${collapsed ? "h-9 w-[33px] self-start rounded-lg hover:bg-panel-2" : "w-[366px] rounded-xl border bg-panel"}`}
    >
      <div inert={collapsed} className={`flex min-h-0 w-[364px] flex-1 flex-col transition-opacity duration-200 ${collapsed ? "opacity-0" : "opacity-100 delay-100"}`}>
        <div className="flex h-9 shrink-0 items-center justify-between bg-panel-2 pr-2 pl-1.5 text-sm">
          <Tabs items={[...TABS]} value={tab} onChange={setTab} className="h-[18px]" />
          <button type="button" aria-label="Collapse panel" onClick={() => setCollapsed(true)} className="text-text-2 hover:text-text">
            <ChevronsLeftIcon className="size-5" />
          </button>
        </div>
        {/* why: usePathname in tabs suspends on unprerendered dynamic routes */}
        <div key={tab} className="flex min-h-0 flex-1 animate-slide-in-left flex-col">
          <Suspense>{TABS.find((t) => t.id === tab)?.body}</Suspense>
        </div>
      </div>
      {collapsed && (
        <button
          type="button"
          aria-label="Expand panel"
          onClick={() => setCollapsed(false)}
          className="absolute inset-x-0 top-0 flex h-9 animate-fade-in items-center justify-center text-text-2 hover:text-text"
        >
          <ChevronsLeftIcon className="size-[18px] rotate-180" />
        </button>
      )}
    </aside>
  );
}
