"use client";

import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { HoverCard } from "@/components/ui/HoverCard";
import { heldIn } from "@/components/home/TokensTable";
import { TokenHoverCard } from "@/components/home/TokenHoverCard";
import { CheckIcon } from "@/components/ui/icons";
import { RowsSkeleton } from "@/components/ui/Skeleton";
import { usd } from "@/lib/format";
import { loadPakts, loadTokens, useLoad } from "@/lib/home/data";
import { Row } from "./Row";

/** the pakt token whitelist at oracle prices */
export function TokensTab() {
  const { data, error } = useLoad(loadTokens, []);
  const pakts = useLoad(loadPakts, []);
  const pathname = usePathname().toLowerCase();

  return (
    <ul className="flex-1 space-y-1 overflow-y-auto px-2 pt-1.5">
      {error && <li className="py-10 text-center text-sm text-text-2">Prices unavailable</li>}
      {!data && !error && <li><RowsSkeleton n={5} className="px-0 py-0" /></li>}
      {data?.map((t) => (
        <li key={t.id}>
          <HoverCard className="w-full *:flex-1" card={<TokenHoverCard token={t} held={pakts.data && heldIn(t.id, pakts.data)} />}>
            <Row
              href={`/token/${t.symbol}`}
              selected={pathname === `/token/${t.symbol.toLowerCase()}`}
              avatar={<Avatar name={t.symbol} src={t.logo} badge={<CheckIcon className="size-3.5 rounded-full bg-accent p-0.5 text-white" strokeWidth={3} />} />}
              title={<>{t.symbol}<Badge>allowed</Badge></>}
              subtitle={t.id}
              value={t.price === null ? "—" : usd(t.price)}
              change={<span className="text-text-3">{t.price === null ? "stale" : "oracle"}</span>}
            />
          </HoverCard>
        </li>
      ))}
    </ul>
  );
}
