"use client";

import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { usd } from "@/lib/format";
import { loadPakts, useLoad, useStarred } from "@/lib/home/data";
import { Row } from "./Row";

export function StarredTab() {
  const pathname = usePathname();
  const { starred } = useStarred();
  const { data } = useLoad(loadPakts, []);
  const list = data?.filter((p) => starred.includes(p.name)) ?? [];

  return (
    <ul className="flex-1 space-y-1 overflow-y-auto px-2">
      <li className="px-2 pt-2 pb-1 text-xs font-bold text-text-3">Pakts</li>
      {!data && starred.length > 0 && <li><Skeleton className="h-[53px] rounded-lg" /></li>}
      {data && !list.length && <li className="py-10 text-center text-sm text-text-2">Star pakts on Discover to keep them here</li>}
      {list.map((p) => (
        <li key={p.vault}>
          <Row
            href={`/pakt/${p.name}`}
            selected={pathname === `/pakt/${p.name}`}
            avatar={<Avatar name={p.name} />}
            title={p.name}
            subtitle={`${p.members} members`}
            value={p.value === null ? "—" : usd(p.value)}
            change={<span className="text-text-2">{p.trader ? `${p.trader.fee_bps / 100}% fee` : "Hiring"}</span>}
          />
        </li>
      ))}
    </ul>
  );
}
