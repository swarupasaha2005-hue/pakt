import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { CheckIcon } from "@/components/ui/icons";
import { Pct } from "@/components/ui/Pct";
import { ago, compact, usd } from "@/lib/format";
import type { Alert } from "@/lib/mock/alerts";
import type { Token } from "@/lib/mock/types";

const CLUSTER = ["top-0 left-0", "bottom-0 left-[3px]", "right-0 top-[5px]"];

export function AlertCard({ alert, token }: { alert: Alert; token: Token }) {
  return (
    <li className="mx-1 border-b pt-[19px] pr-[7px] pb-[15px] pl-[9px]">
      <div className="flex h-5 items-center gap-2">
        {/* fomo: 3 faces in a 23px triangle cluster */}
        <span className="relative mr-[-1px] size-[23px] shrink-0">
          {alert.actors.slice(0, 3).map((n, i) => (
            <span key={n} className={`absolute flex rounded-full ring-1 ring-panel ${CLUSTER[i]}`}>
              <Avatar name={n} size={13} />
            </span>
          ))}
        </span>
        <span className="text-base font-medium">{alert.actors.length} {alert.unit}</span>
        <Badge tone={alert.side === "buy" ? "up" : "down"}>{alert.side === "buy" ? "Buy" : "Sell"}</Badge>
        <span className="text-base font-medium">{compact(alert.size)}</span>
        <span className="ml-auto text-sm text-text-3">{ago(alert.secondsAgo)}</span>
      </div>
      <Link href={`/token/${token.symbol}`} className="mt-2.5 ml-[30px] flex items-center gap-2 rounded-xl border bg-panel-2 py-2.5 pr-3 pl-3.5 transition hover:brightness-125">
        <Avatar
          name={token.symbol}
          src={token.logo}
          size={34}
          badge={token.allowed && <CheckIcon className="size-3.5 rounded-full bg-accent p-0.5 text-white" strokeWidth={3} />}
        />
        <span className="flex flex-1 flex-col">
          <span className="text-base leading-[22px]">{token.symbol}</span>
          <span className="text-sm leading-[22px] text-text-2">{compact(token.mcap)} MC</span>
        </span>
        <span className="flex flex-col items-end">
          <span className="text-base leading-[22px]">{usd(token.price)}</span>
          <span className="text-sm leading-[22px] text-text-2">
            <Pct value={alert.change1h} /> in 1h
          </span>
        </span>
      </Link>
    </li>
  );
}
