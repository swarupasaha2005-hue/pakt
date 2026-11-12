"use client";

import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { usd } from "@/lib/format";
import { loadTokens, useLoad } from "@/lib/home/data";

/** the pakt token whitelist at oracle prices */
export function PinStrip() {
  const { data, error } = useLoad(loadTokens, []);
  if (error) {
    return <div className="flex h-16 w-fit shrink-0 items-center rounded-xl border px-3 text-sm text-text-3">Prices unavailable</div>;
  }
  return (
    <div className="flex h-16 shrink-0 gap-2 overflow-x-auto">
      {data
        ? data.map((t) => (
            <div key={t.id} className="flex shrink-0 items-center gap-2.5 rounded-xl border px-3">
              <Avatar name={t.symbol} src={t.logo} size={32} />
              <span className="flex flex-col">
                <span className="text-sm leading-5">{t.symbol}</span>
                <span className="text-xs leading-5 text-text-2">{t.price === null ? "Price stale" : usd(t.price)}</span>
              </span>
            </div>
          ))
        : [0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-36 rounded-xl" />)}
    </div>
  );
}
