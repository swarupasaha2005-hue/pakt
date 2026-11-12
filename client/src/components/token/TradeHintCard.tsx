import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import type { PaktInfo } from "@/lib/home/data";

/** trading happens on the pakt page for its hired trader; list pakts that whitelist the token */
export function TradeHintCard({ symbol, pakts }: { symbol: string; pakts?: PaktInfo[] }) {
  return (
    <section className="border-b p-4">
      <h2 className="text-base font-medium">Traders trade {symbol} inside a pakt</h2>
      <p className="mt-1 text-xs text-text-2">Members pool funds, a hired trader swaps within caps. Pakts whitelisting {symbol}:</p>
      <ul className="mt-3 space-y-1">
        {!pakts
          ? [0, 1].map((i) => <li key={i}><Skeleton className="h-9 rounded-xl" /></li>)
          : !pakts.length
            ? <li className="py-4 text-center text-xs text-text-2">No pakt whitelists {symbol} yet</li>
            : pakts.map((p) => (
                <li key={p.vault}>
                  <Link href={`/pakt/${p.name}`} className="flex h-9 items-center gap-2 rounded-xl px-2 text-sm hover:bg-panel-2/60">
                    <Avatar name={p.name} size={20} />
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-xs text-text-2">{p.trader ? p.trader.account : "hiring"}</span>
                  </Link>
                </li>
              ))}
      </ul>
    </section>
  );
}
