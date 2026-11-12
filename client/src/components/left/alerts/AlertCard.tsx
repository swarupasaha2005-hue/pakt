import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { CheckIcon } from "@/components/ui/icons";
import type { Alert } from "@/lib/api";
import { token as tokenInfo } from "@/lib/config";
import { ago, compact, usd } from "@/lib/format";
import { usdNum, type TokenPrice } from "@/lib/home/data";

const CLUSTER = ["top-0 left-0", "bottom-0 left-[3px]", "right-0 top-[5px]"];

/** token: price info, undefined while prices load */
export function AlertCard({ alert, token, now }: { alert: Alert; token?: TokenPrice; now: number }) {
  const symbol = token?.symbol ?? tokenInfo(alert.token)?.symbol ?? alert.token;
  return (
    <li className="mx-1 border-b pt-[19px] pr-[7px] pb-[15px] pl-[9px]">
      <div className="flex h-5 items-center gap-2">
        {/* 3 faces in a 23px triangle cluster */}
        <span className="relative mr-[-1px] size-[23px] shrink-0">
          {alert.traders.slice(0, 3).map((n, i) => (
            <span key={n} className={`absolute flex rounded-full ring-1 ring-panel ${CLUSTER[i]}`}>
              <Avatar name={n} size={13} />
            </span>
          ))}
        </span>
        <span className="text-sm font-medium">{alert.traders.length} traders</span>
        <Badge tone={alert.side === "buy" ? "up" : "down"}>{alert.side === "buy" ? "Buy" : "Sell"}</Badge>
        <span className="text-sm font-medium">{compact(usdNum(alert.total_value))}</span>
        <span className="ml-auto text-xs text-text-3">{ago(Math.max(0, Math.floor((now - alert.last_at) / 1000)))}</span>
      </div>
      <div className="mt-2.5 ml-[30px] flex items-center gap-2 rounded-xl border bg-panel-2 py-[15px] pr-3 pl-3.5">
        <Avatar
          name={symbol}
          src={token?.logo}
          size={34}
          badge={<CheckIcon className="size-3.5 rounded-full bg-accent p-0.5 text-white" strokeWidth={3} />}
        />
        <span className="flex flex-1 flex-col">
          <span className="text-sm leading-5">{symbol}</span>
          <span className="text-xs text-text-2">{alert.count} trades</span>
        </span>
        <span className="text-sm leading-5">{token?.price == null ? "—" : usd(token.price)}</span>
      </div>
    </li>
  );
}
