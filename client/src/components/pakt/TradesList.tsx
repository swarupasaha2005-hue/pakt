import { Avatar } from "@/components/ui/Avatar";
import type { FeedEvent } from "@/lib/mock/types";

const ago = (s: number) => (s < 3_600 ? `${Math.max(1, Math.round(s / 60))}m` : s < 86_400 ? `${Math.round(s / 3_600)}h` : `${Math.round(s / 86_400)}d`);

export function TradesList({ trades }: { trades: FeedEvent[] }) {
  if (!trades.length) return <p className="py-8 text-center text-sm text-text-2">No trades yet</p>;
  return (
    <ul>
      {trades.map((t) => (
        <li key={t.id} className="flex items-center gap-3 border-t py-2.5 text-xs">
          <Avatar name={t.actor} size={28} />
          <span className="flex-1">
            {t.actor} <span className={t.kind === "buy" ? "text-up" : "text-down"}>{t.kind === "buy" ? "bought" : "sold"}</span> {t.detail}
          </span>
          <span className="text-xs text-text-3">{ago(t.secondsAgo)}</span>
        </li>
      ))}
    </ul>
  );
}
