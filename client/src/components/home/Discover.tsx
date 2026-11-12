"use client";

import { PaktsTab } from "@/components/left/PaktsTab";
import { TokensTab } from "@/components/left/TokensTab";
import { Tabs } from "@/components/ui/Tabs";
import { usePersisted } from "@/lib/home/data";
import { ForYou } from "./ForYou";
import { MarketTable } from "./MarketTable";

const PHONE = [
  { id: "pakts", label: "Pakts" },
  { id: "tokens", label: "Tokens" },
] as const;
type Phone = (typeof PHONE)[number]["id"];

/** what needs you on top, pakts / tokens / positions table below; phones get the compact lists */
export function Discover() {
  const [tab, setTab] = usePersisted<Phone>("pakt:phone-tab", "pakts", (v): v is Phone => PHONE.some((t) => t.id === v));
  return (
    <main className="flex min-w-0 flex-1 flex-col gap-3">
      <ForYou />
      <MarketTable />
      <section className="flex flex-col rounded-xl border bg-panel pb-2 md:hidden">
        <Tabs items={[...PHONE]} value={tab} onChange={setTab} className="h-11 shrink-0 border-b px-3 text-base" />
        <div className="flex flex-col pt-2">{tab === "pakts" ? <PaktsTab /> : <TokensTab />}</div>
      </section>
    </main>
  );
}
