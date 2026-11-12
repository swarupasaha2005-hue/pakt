import { Avatar } from "@/components/ui/Avatar";
import { CheckIcon, CopyIcon } from "@/components/ui/icons";
import { usd } from "@/lib/format";
import type { PaktInfo, TokenPrice } from "@/lib/home/data";

type Props = {
  token: TokenPrice;
  /** pakts holding it, largest first; undefined while loading */
  held?: { pakt: PaktInfo; value: number }[];
};

/** 56px row; tokens have no page, so the row is not a link */
export function TokenRow({ token: t, held }: Props) {
  const top = held?.[0]?.pakt;
  const total = held?.reduce((a, h) => a + h.value, 0);

  return (
    <tr className="group relative h-14 text-base hover:bg-panel-2/60">
      <td className="border-r px-3">
        <span className="flex items-center gap-3">
          <Avatar name={t.symbol} src={t.logo} badge={<CheckIcon className="size-3.5 rounded-full bg-accent p-0.5 text-white" strokeWidth={3} />} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="leading-6">{t.symbol}</span>
            <span className="flex items-center gap-1.5 text-xs leading-4 text-text-2">
              <span className="truncate">{t.id}</span>
              <button type="button" aria-label={`Copy ${t.symbol} contract`} onClick={() => navigator.clipboard.writeText(t.id)} className="text-text-3 hover:text-text">
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
