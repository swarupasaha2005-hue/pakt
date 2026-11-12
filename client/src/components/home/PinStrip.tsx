"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { StarIcon } from "@/components/ui/icons";
import { usd } from "@/lib/format";
import { loadTokens, useLoad, useStarred } from "@/lib/home/data";

/** starred tokens as 176x66 cards; a hint box when none are starred */
export function PinStrip() {
  const { data } = useLoad(loadTokens, []);
  const { starred, toggle } = useStarred();
  const pinned = data?.filter((t) => starred.includes(t.symbol)) ?? [];

  if (!pinned.length) {
    return <div data-tour="pins" className="flex h-[66px] w-fit shrink-0 items-center rounded-xl border px-3 text-sm text-text-3">Star assets to pin them here</div>;
  }
  return (
    <section data-tour="pins" className="flex h-[66px] shrink-0 gap-3 overflow-x-auto">
      {pinned.map((t) => (
        <Link key={t.id} href={`/token/${t.symbol}`} className="flex w-44 shrink-0 animate-fade-in flex-col gap-2 rounded-xl border p-2 text-sm font-medium hover:bg-panel-2">
          <span className="flex h-5 items-center justify-between gap-2">
            <Avatar name={t.symbol} src={t.logo} size={20} />
            <span className="flex items-center gap-1 text-text-2">
              {t.symbol}
              <button
                type="button"
                aria-label={`Unstar ${t.symbol}`}
                onClick={(e) => {
                  e.preventDefault(); // inside the card link
                  toggle(t.symbol);
                }}
              >
                <StarIcon className="size-3 fill-current text-yellow-400" />
              </button>
            </span>
          </span>
          <span className="flex h-5 items-center justify-between gap-2">
            <span>{t.price === null ? "—" : usd(t.price)}</span>
            <span className="text-text-3">{t.price === null ? "stale" : "oracle"}</span>
          </span>
        </Link>
      ))}
    </section>
  );
}
