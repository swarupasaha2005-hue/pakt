"use client";

import { useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { CopyIcon, StarIcon } from "@/components/ui/icons";
import { Pct } from "@/components/ui/Pct";
import { usd } from "@/lib/format";
import { useStarred, type PaktInfo, type TokenPrice } from "@/lib/home/data";

type Props = {
  token: TokenPrice;
  /** pakts holding it (heldIn); omitted rows are hidden */
  held?: { pakt: PaktInfo; value: number }[];
  /** 24h change in percent, when the caller has it */
  change?: number;
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex h-6 items-center gap-2 text-xs">
      <span className="text-text-2">{label}</span>
      <span className="flex-1 border-b border-dotted border-text-3" />
      <span className="flex min-w-0 items-center gap-1 text-text">{children}</span>
    </div>
  );
}

/** HoverCard body for a token: logo + star, price, pakt holdings, contract */
export function TokenHoverCard({ token: t, held, change }: Props) {
  const { starred, toggle } = useStarred();
  const star = starred.includes(t.symbol);
  const [squish, setSquish] = useState(0);
  const total = held?.reduce((a, h) => a + h.value, 0);

  return (
    <div className="flex flex-col">
      <div className="flex items-start justify-between">
        <Avatar name={t.symbol} src={t.logo} size={40} />
        <button
          type="button"
          aria-label={star ? `Unstar ${t.symbol}` : `Star ${t.symbol}`}
          aria-pressed={star}
          onClick={() => {
            toggle(t.symbol);
            setSquish((n) => n + 1);
          }}
        >
          <StarIcon key={squish} className={`size-4 ${squish ? "animate-squish" : ""} ${star ? "fill-current text-yellow-400" : "text-text-2 hover:text-text"}`} />
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between text-sm font-bold">
        <span>{t.symbol}</span>
        {total !== undefined && <span>{usd(total)}</span>}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-2">{t.price === null ? "Price stale" : usd(t.price)}</span>
        {change !== undefined && <Pct value={change} />}
      </div>
      <div className="mt-2">
        {held && <Row label="Held by pakts">{held.length}</Row>}
        {held?.[0] && <Row label="Top pakt">{held[0].pakt.name}</Row>}
        <Row label="Decimals">{t.decimals}</Row>
        <Row label="Contract">
          <span className="max-w-[120px] truncate">{t.id}</span>
          <button type="button" aria-label={`Copy ${t.symbol} contract`} onClick={() => navigator.clipboard.writeText(t.id)} className="text-text-3 hover:text-text">
            <CopyIcon className="size-3" />
          </button>
        </Row>
      </div>
    </div>
  );
}
