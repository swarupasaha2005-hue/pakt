import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { HoverCard } from "@/components/ui/HoverCard";
import { CheckIcon, CopyIcon } from "@/components/ui/icons";
import { usd } from "@/lib/format";
import type { PaktInfo, TokenPrice } from "@/lib/home/data";
import { TokenHoverCard } from "./TokenHoverCard";

type Props = {
  token: TokenPrice;
  /** pakts holding it, largest first; undefined while loading */
  held?: { pakt: PaktInfo; value: number }[];
};

/** 56px row; symbol link stretches over the row, the copy button sits above it */
export function TokenRow({ token: t, held }: Props) {
  const top = held?.[0]?.pakt;
  const total = held?.reduce((a, h) => a + h.value, 0);

  return (
    <tr className="group relative h-14 text-base hover:bg-panel-2/60">
      <td className="border-r px-3">
        <span className="flex items-center gap-3">
          {/* z-10: above the stretched row link so the avatar gets hover */}
          <HoverCard className="relative z-10" card={<TokenHoverCard token={t} held={held} />}>
            <Avatar name={t.symbol} src={t.logo} badge={<CheckIcon className="size-3.5 rounded-full bg-accent p-0.5 text-white" strokeWidth={3} />} />
          </HoverCard>
          <span className="flex min-w-0 flex-1 flex-col">
            <Link href={`/token/${t.symbol}`} className="leading-6 after:absolute after:inset-0">
              {t.symbol}
            </Link>
            <span className="flex items-center gap-1.5 text-xs leading-4 text-text-2">
              <span className="truncate">{t.id}</span>
              <button type="button" aria-label={`Copy ${t.symbol} contract`} onClick={() => navigator.clipboard.writeText(t.id)} className="relative z-10 text-text-3 hover:text-text">
                <CopyIcon className="size-3.5" />
              </button>
            </span>
          </span>
        </span>
      </td>
      <td className="px-3">{t.price === null ? <span className="text-text-3">—</span> : usd(t.price)}</td>
      <td className="px-3 text-sm">
        {total === undefined ? "…" : (
          <span className="flex flex-col leading-5">
            {usd(total)}
            <span className="text-xs leading-4 text-text-3">{held!.length} pakts</span>
          </span>
        )}
      </td>
      <td className="px-3">
        {top ? (
          <span className="flex items-center gap-2">
            <Avatar name={top.trader?.account ?? top.name} size={20} />
            <span className="flex flex-col leading-5">
              <span className="text-sm">{top.name}</span>
              <span className="text-xs text-text-2">{top.trader?.account}</span>
            </span>
          </span>
        ) : (
          <span className="text-text-3">—</span>
        )}
      </td>
    </tr>
  );
}
