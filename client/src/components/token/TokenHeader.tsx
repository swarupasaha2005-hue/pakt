import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { CheckIcon, CopyIcon, ExternalIcon } from "@/components/ui/icons";
import type { TokenInfo } from "@/lib/config";
import { compact, usd } from "@/lib/format";
import { addressUrl, NAMES, type Stats } from "@/lib/token/data";

type Props = { token: TokenInfo; logo?: string; price: number | null | undefined; stats?: Stats | null };

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex h-12 min-w-20 flex-col items-center justify-center rounded-lg border px-2.5">
      <span className="text-xs leading-4 text-text-2">{label}</span>
      <span className="text-sm leading-5 font-medium">{children}</span>
    </div>
  );
}

export function TokenHeader({ token: t, logo, price, stats }: Props) {
  const day = stats?.change["1D"];
  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 pt-0.5">
      <div className="flex items-center gap-3">
        <Avatar name={t.symbol} src={logo} size={40} badge={<CheckIcon className="size-3.5 rounded-full bg-accent p-0.5 text-white" strokeWidth={3} />} />
        <div className="flex flex-col">
          <span className="flex items-center gap-2 text-base leading-5 font-medium">
            {t.symbol}
            <Badge>allowed</Badge>
            <a href={addressUrl(t.id)} target="_blank" rel="noreferrer" aria-label={`${t.symbol} on nearblocks`} className="text-text-2 hover:text-text">
              <ExternalIcon className="size-4" />
            </a>
          </span>
          <span className="flex items-center gap-1.5 text-xs text-text-2">
            {NAMES[t.symbol] ?? t.symbol} · {t.id}
            <button type="button" aria-label={`Copy ${t.symbol} contract`} onClick={() => navigator.clipboard.writeText(t.id)} className="text-text-3 hover:text-text">
              <CopyIcon className="size-3.5" />
            </button>
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Stat label="Oracle price">{price === undefined ? "…" : price === null ? "Stale" : usd(price)}</Stat>
        <Stat label="24H change">
          {day == null ? "—" : <span className={day < 0 ? "text-down" : "text-up"}>{day < 0 ? "▾" : "▴"} {Math.abs(day).toFixed(2)}%</span>}
        </Stat>
        <Stat label="24H vol (mainnet)">{stats ? compact(stats.vol24) : "—"}</Stat>
      </div>
    </header>
  );
}
