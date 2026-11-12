"use client";

import { useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { usePersisted } from "@/lib/home/data";
import { PaktsTable, PAKT_FILTERS, type PaktFilter } from "./PaktsTable";
import { Positions } from "./Positions";
import { TokensTable } from "./TokensTable";

const TABS = [{ id: "pakts", label: "Pakts" }, { id: "positions", label: "Positions" }, { id: "tokens", label: "Tokens" }] as const;

type Tab = (typeof TABS)[number]["id"];

export function MarketTable() {
  const [tab, setTab] = usePersisted<Tab>("pakt:market-tab", "pakts", (v): v is Tab => TABS.some((t) => t.id === v));
  const [filter, setFilter] = useState<PaktFilter>("All");
  return (
    <section data-tour="market" className="hidden min-w-0 flex-1 flex-col md:flex overflow-hidden rounded-xl border bg-panel">
      <div className="flex shrink-0 flex-col gap-2 border-b px-3 pt-3 pb-2">
        <div role="tablist" className="flex items-center gap-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              data-tour={t.id === "positions" ? "positions" : undefined}
              role="tab"
              aria-selected={t.id === tab}
              onClick={() => setTab(t.id)}
              className={`text-base font-medium transition-colors ${t.id === tab ? "text-text" : "text-text-2 hover:text-text"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === "pakts" && <Segmented options={PAKT_FILTERS} value={filter} onChange={setFilter} />}
      </div>
      {tab === "tokens" ? <TokensTable /> : tab === "positions" ? <Positions /> : <PaktsTable filter={filter} />}
    </section>
  );
}
