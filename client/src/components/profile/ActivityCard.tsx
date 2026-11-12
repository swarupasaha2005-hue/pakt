"use client";

import Link from "next/link";
import { useNow } from "@/lib/home/data";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Row } from "@/components/left/Row";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { ago, signed, usd } from "@/lib/format";
import { detail, e6, paktName, VERB } from "@/lib/profile/format";
import type { ProfileData } from "@/lib/profile/load";

const TABS = [
  { id: "feed", label: "Feed" },
  { id: "transactions", label: "Transactions" },
  { id: "pakts", label: "Pakts" },
] as const;
type Tab = (typeof TABS)[number]["id"];

/** tab lives in ?tab= so the account menu can deep-link "Your pakts" */
export function ActivityCard({ account, data }: { account: string; data: ProfileData }) {
  const router = useRouter();
  const pathname = usePathname();
  const param = useSearchParams().get("tab");
  const tab: Tab = TABS.find((t) => t.id === param)?.id ?? "feed";
  const shown = tab === "transactions" ? data.events.filter((e) => e.kind === "trade") : data.events;
  const tenures = data.trader?.pakts ?? [];
  const now = useNow();

  return (
    <section className="overflow-hidden rounded-xl border">
      <div className="flex h-[41px] items-center bg-panel px-1.5 text-sm">
        <Tabs items={[...TABS]} value={tab} onChange={(id) => router.replace(`${pathname}?tab=${id}`, { scroll: false })} className="h-[18px]" />
      </div>
      {tab === "pakts" ? (
        tenures.length + data.positions.length === 0 ? (
          <Empty>No pakts yet</Empty>
        ) : (
          <ul className="p-1">
            {tenures.map((t) => {
              const name = paktName(t.vault);
              const pnl = e6(t.pnl);
              return (
                <li key={`trader-${t.vault}-${t.hired_at}`}>
                  <Row
                    href={`/pakt/${name}`}
                    avatar={<Avatar name={name} />}
                    title={<>{name}<Badge>Pakter</Badge></>}
                    subtitle={`${t.trades} trades${t.terms.fee_bps === undefined ? "" : ` · ${t.terms.fee_bps / 100}% fee`}`}
                    value={<span className={pnl < 0 ? "text-down" : "text-up"}>{signed(pnl)}</span>}
                    change={<span className="text-text-2">{t.fired_at === null ? "Live" : "Ended"}</span>}
                  />
                </li>
              );
            })}
            {data.positions.map((p) => (
              <li key={p.vault}>
                <Row
                  href={`/pakt/${p.name}`}
                  avatar={<Avatar name={p.name} />}
                  title={<>{p.name}<Badge tone="neutral">{p.member ? "Member" : "Fee shares"}</Badge></>}
                  subtitle={`${p.pct.toFixed(2)}% of pakt`}
                  value={p.value === null ? "--" : usd(p.value)}
                  change=""
                />
              </li>
            ))}
          </ul>
        )
      ) : shown.length === 0 ? (
        <Empty>No activity yet</Empty>
      ) : (
        <ul className="divide-y">
          {shown.map((e) => (
            <li key={e.id} className="flex gap-2.5 px-3 py-2.5 text-xs">
              <Avatar name={account} size={28} />
              <div className="min-w-0 flex-1">
                <p className="flex justify-between gap-2">
                  <span>
                    {VERB[e.kind]} <span className="text-text-2">in</span>{" "}
                    <Link href={`/pakt/${paktName(e.vault)}`} className="hover:underline">{paktName(e.vault)}</Link>
                  </span>
                  <span className="text-xs text-text-3">{ago(Math.max(0, Math.floor((now - e.ts_ms) / 1000)))}</span>
                </p>
                <p className="truncate text-text-2">{detail(e)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Empty({ children }: { children: string }) {
  return <p className="py-5 text-center text-sm text-text-2">{children}</p>;
}
