import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { CheckIcon, ExternalIcon } from "@/components/ui/icons";
import { Pct } from "@/components/ui/Pct";
import { compact, usd } from "@/lib/format";
import type { Token } from "@/lib/mock/types";

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex h-[46px] flex-col items-center justify-center rounded-xl bg-panel-2 px-3">
      <span className="text-[13px] leading-4 text-text-2">{label}</span>
      <span className="text-base leading-5 font-medium">{children}</span>
    </div>
  );
}

export function TokenHeader({ token: t }: { token: Token }) {
  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 pt-0.5">
      <div className="flex items-center gap-3">
        <Avatar
          name={t.symbol}
          src={t.logo}
          size={40}
          badge={t.allowed && <CheckIcon className="size-3.5 rounded-full bg-accent p-0.5 text-white" strokeWidth={3} />}
        />
        <div className="flex flex-col">
          <span className="flex items-center gap-2 text-lg leading-6 font-medium">
            {t.symbol}
            {t.allowed ? <Badge>allowed</Badge> : <Badge tone="down">not allowed</Badge>}
            <a href={`https://x.com/search?q=%24${t.symbol}`} target="_blank" rel="noreferrer" aria-label={`Search ${t.symbol} on X`} className="text-text-2 hover:text-text">
              <ExternalIcon className="size-4" />
            </a>
          </span>
          <span className="text-sm text-text-2">{t.name}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-center px-3">
          <span className="text-[13px] leading-4 text-text-2">Price</span>
          <span className="text-[22px] leading-7 font-semibold">{usd(t.price)}</span>
        </div>
        <Stat label="24H Vol.">{compact(t.volume24h)}</Stat>
        <Stat label="Market cap">{compact(t.mcap)}</Stat>
        <Stat label="24H change">
          <Pct value={t.change24h} />
        </Stat>
      </div>
    </header>
  );
}
