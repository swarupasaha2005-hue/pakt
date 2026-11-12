import { Avatar } from "@/components/ui/Avatar";
import type { PaktEvent } from "@/lib/api";
import { BASE_TOKEN } from "@/lib/config";
import { ago, usd } from "@/lib/format";
import { amount, e6, nearblocks } from "@/lib/pakt/units";

type TradeEvent = Extract<PaktEvent, { kind: "trade" }>;

export function TradesList({ trades, now }: { trades: TradeEvent[]; now: number }) {
  if (!trades.length) return <p className="py-8 text-center text-sm text-text-2">No trades yet</p>;
  return (
    <ul>
      {trades.map((t) => {
        const buy = t.data.token_in === BASE_TOKEN.id;
        const [id, raw] = buy ? [t.data.token_out, t.data.amount_out] : [t.data.token_in, t.data.amount_in];
        return (
          <li key={t.id} className="flex items-center gap-3 border-t py-2.5 text-xs">
            <Avatar name={t.actor} size={28} />
            <span className="flex-1">
              {t.actor} <span className={buy ? "text-up" : "text-down"}>{buy ? "bought" : "sold"}</span> {amount(id, raw)} for {usd(e6(t.data.value))}
            </span>
            <a href={nearblocks(t.tx_hash)} target="_blank" rel="noreferrer" className="text-xs text-text-3 hover:text-text">
              {ago(Math.max(0, Math.round((now - t.ts_ms) / 1000)))}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
