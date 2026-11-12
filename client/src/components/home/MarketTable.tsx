"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/Tabs";
import { PaktsTable } from "./PaktsTable";
import { TokensTable } from "./TokensTable";

export function MarketTable() {
  const [tab, setTab] = useState<"tokens" | "pakts">("pakts");
  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-panel">
      <div className="flex h-9 shrink-0 items-center bg-panel-2 px-2 text-sm">
        <Tabs items={[{ id: "pakts", label: "Pakts" }, { id: "tokens", label: "Tokens" }]} value={tab} onChange={setTab} className="h-[18px]" />
      </div>
      {tab === "tokens" ? <TokensTable /> : <PaktsTable />}
    </section>
  );
}
