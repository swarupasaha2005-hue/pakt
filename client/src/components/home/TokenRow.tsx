import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { CheckIcon, CopyIcon, SearchIcon, StarIcon, UsersIcon } from "@/components/ui/icons";
import { Pct } from "@/components/ui/Pct";
import { compact, count } from "@/lib/format";
import { holders, topPakt } from "@/lib/mock/holders";
import { pakts } from "@/lib/mock/pakts";
import { changeIn, volumeIn, type Timeframe } from "@/lib/mock/timeframes";
import type { Token } from "@/lib/mock/types";

type Props = { token: Token; tf: Timeframe; starred: boolean; onStar: (symbol: string) => void; quickBuy: number };

const iconLink = "relative z-10 text-text-3 hover:text-text";

/** 56px row; symbol link stretches over the row, buttons sit above it */
export function TokenRow({ token: t, tf, starred, onStar, quickBuy }: Props) {
  const top = topPakt(t);
  const pakt = pakts.find((p) => p.id === top?.paktId);
  const paktCount = new Set(holders(t).map((h) => h.paktId).filter(Boolean)).size;

  return (
    <tr className="group relative h-14 text-base hover:bg-panel-2/60">
      <td className="border-r px-3">
        <span className="flex items-center gap-3">
          <button type="button" aria-label={starred ? `Unstar ${t.symbol}` : `Star ${t.symbol}`} aria-pressed={starred} onClick={() => onStar(t.symbol)} className="relative z-10">
            <StarIcon className={`size-[18px] ${starred ? "fill-current text-accent" : "text-text-2 hover:text-text"}`} />
          </button>
          <Avatar
            name={t.symbol}
            glyph={t.glyph}
            color={t.color}
            badge={t.allowed && <CheckIcon className="size-3.5 rounded-full bg-accent p-0.5 text-white" strokeWidth={3} />}
          />
          <span className="flex min-w-0 flex-1 flex-col">
            <Link href={`/token/${t.symbol}`} className="leading-5 after:absolute after:inset-0">
              {t.symbol}
            </Link>
            <span className="flex items-center gap-1.5 text-sm leading-5 text-text-2">
              <span className="truncate">{t.name}</span>
              <button type="button" aria-label={`Copy ${t.symbol}`} onClick={() => navigator.clipboard.writeText(t.symbol)} className={iconLink}>
                <CopyIcon className="size-3.5" />
              </button>
              <a href={`https://x.com/search?q=%24${t.symbol}`} target="_blank" rel="noreferrer" aria-label={`Search ${t.symbol} on X`} className={iconLink}>
                <SearchIcon className="size-3.5" />
              </a>
            </span>
          </span>
          {t.allowed && quickBuy > 0 && (
            <Link
              href={`/token/${t.symbol}?amount=${quickBuy}`}
              className="relative z-10 rounded-lg bg-up-bg px-2.5 py-1 text-[13px] font-semibold text-up opacity-0 transition group-hover:opacity-100 focus:opacity-100"
            >
              Buy ${quickBuy}
            </Link>
          )}
        </span>
      </td>
      <td className="px-3">{compact(t.mcap)}</td>
      <td className="px-3">
        <Pct value={changeIn(t, tf)} />
      </td>
      <td className="px-3">{compact(volumeIn(t, tf))}</td>
      <td className="px-3">
        <span className="flex items-start gap-2">
          <UsersIcon className="mt-0.5 size-4 text-text-2" />
          <span className="flex flex-col leading-5">
            {count(t.holders)}
            <span className="text-sm text-text-3">{paktCount} pakts</span>
          </span>
        </span>
      </td>
      <td className="px-3">
        {pakt ? (
          <span className="flex items-center gap-2">
            <Avatar name={pakt.trader ?? pakt.name} size={20} />
            <span className="flex flex-col leading-5">
              <span className="text-[15px] font-semibold">{pakt.name}</span>
              <span className="text-sm text-text-2">{pakt.trader}</span>
            </span>
          </span>
        ) : (
          <span className="text-text-3">—</span>
        )}
      </td>
    </tr>
  );
}
