"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Row } from "@/components/left/Row";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Pct } from "@/components/ui/Pct";
import { Tabs } from "@/components/ui/Tabs";
import { usd } from "@/lib/format";
import type { FeedEvent, FeedKind, Pakt } from "@/lib/mock/types";

const TABS = [
  { id: "feed", label: "Feed" },
  { id: "transactions", label: "Transactions" },
  { id: "pakts", label: "Pakts" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const VERB: Record<FeedKind, string> = {
  buy: "Bought",
  sell: "Sold",
  vote: "Voted",
  hired: "Hired",
  fired: "Fired",
  settled: "Settled",
  joined: "Joined",
  left: "Left",
  stoploss: "Stop-loss",
};

const ago = (s: number) => (s < 60 ? `${s}s` : s < 3_600 ? `${Math.floor(s / 60)}m` : s < 86_400 ? `${Math.floor(s / 3_600)}h` : `${Math.floor(s / 86_400)}d`);

type Props = {
  account: string;
  /** events where account is the actor */
  events: FeedEvent[];
  /** pakts account trades for or is a member of */
  pakts: Pakt[];
};

/** tab lives in ?tab= so the account menu can deep-link "Your pakts" */
export function ActivityCard({ account, events, pakts }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const param = useSearchParams().get("tab");
  const tab: Tab = TABS.find((t) => t.id === param)?.id ?? "feed";
  const shown = tab === "transactions" ? events.filter((e) => e.kind === "buy" || e.kind === "sell") : events;

  return (
    <section className="overflow-hidden rounded-xl border">
      <div className="flex h-[41px] items-center bg-panel px-1.5 text-[15px]">
        <Tabs items={[...TABS]} value={tab} onChange={(id) => router.replace(`${pathname}?tab=${id}`, { scroll: false })} className="h-[18px]" />
      </div>
      {tab === "pakts" ? (
        pakts.length === 0 ? (
          <Empty>No pakts yet</Empty>
        ) : (
          <ul className="p-1">
            {pakts.map((p) => (
              <li key={p.id}>
                <Row
                  href={`/pakt/${p.id}`}
                  avatar={<Avatar name={p.name} />}
                  title={<>{p.name}{p.trader === account ? <Badge>Trader</Badge> : <Badge tone="neutral">Member</Badge>}</>}
                  subtitle={`${p.members.length} members · ${p.fee}% fee`}
                  value={usd(p.vaultValue)}
                  change={<Pct value={p.pnl7dPct} />}
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
            <li key={e.id} className="flex gap-2.5 px-3 py-2.5 text-sm">
              <Avatar name={account} size={28} />
              <div className="min-w-0 flex-1">
                <p className="flex justify-between gap-2">
                  <span>
                    {VERB[e.kind]} <span className="text-text-2">in</span> {e.paktId}
                  </span>
                  <span className="text-[13px] text-text-3">{ago(e.secondsAgo)}</span>
                </p>
                <p className="truncate text-text-2">{e.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Empty({ children }: { children: string }) {
  return <p className="py-5 text-center text-[15px] text-text-2">{children}</p>;
}
