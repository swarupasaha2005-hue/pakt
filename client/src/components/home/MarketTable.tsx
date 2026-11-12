"use client";

import { useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { PaktsTable, PAKT_FILTERS, type PaktFilter } from "./PaktsTable";
import { TokensTable } from "./TokensTable";

const TABS = [{ id: "pakts", label: "Pakts" }, { id: "tokens", label: "Tokens" }] as const;

export function MarketTable() {
  const [tab, setTab] = useState<"tokens" | "pakts">("pakts");
  const [filter, setFilter] = useState<PaktFilter>("All");
  return (
    <section data-tour="market" className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-panel">
      <div className="flex shrink-0 flex-col gap-2 border-b px-3 pt-3 pb-2">
        <div role="tablist" className="flex items-center gap-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
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
      {tab === "tokens" ? <TokensTable /> : <PaktsTable filter={filter} />}
    </section>
  );
}
