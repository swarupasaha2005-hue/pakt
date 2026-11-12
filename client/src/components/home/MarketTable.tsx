"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/Tabs";
import { PaktsTable } from "./PaktsTable";
import { TokensTable } from "./TokensTable";

type Props = { starred: string[]; onStar: (symbol: string) => void };

export function MarketTable({ starred, onStar }: Props) {
  const [tab, setTab] = useState<"tokens" | "pakts">("tokens");
  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-panel">
      <div className="flex h-[37px] shrink-0 items-center border-b px-2 text-[15px]">
        <Tabs items={[{ id: "tokens", label: "Tokens" }, { id: "pakts", label: "Pakts" }]} value={tab} onChange={setTab} className="h-[18px]" />
      </div>
      {tab === "tokens" ? <TokensTable starred={starred} onStar={onStar} /> : <PaktsTable />}
    </section>
  );
}
