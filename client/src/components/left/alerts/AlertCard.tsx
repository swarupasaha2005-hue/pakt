import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { Badge } from "@/components/ui/Badge";
import { CheckIcon } from "@/components/ui/icons";
import { Pct } from "@/components/ui/Pct";
import { ago, compact, usd } from "@/lib/format";
import type { Alert } from "@/lib/mock/alerts";
import type { Token } from "@/lib/mock/types";

export function AlertCard({ alert, token }: { alert: Alert; token: Token }) {
  return (
    <li className="border-b px-3 py-4">
      <div className="flex items-center gap-2 pl-1">
        <span className="w-8">
          <AvatarStack names={alert.actors} />
        </span>
        <span className="text-base font-medium">{alert.actors.length} {alert.unit}</span>
        <Badge tone={alert.side === "buy" ? "up" : "down"}>{alert.side === "buy" ? "Buy" : "Sell"}</Badge>
        <span className="text-base font-medium">{compact(alert.size)}</span>
        <span className="ml-auto text-sm text-text-3">{ago(alert.secondsAgo)}</span>
      </div>
      <Link href={`/token/${token.symbol}`} className="mt-2 ml-11 flex items-center gap-2.5 rounded-xl border bg-panel-2 p-3 transition hover:brightness-125">
        <Avatar
          name={token.symbol}
          glyph={token.glyph}
          color={token.color}
          badge={token.allowed && <CheckIcon className="size-3.5 rounded-full bg-accent p-0.5 text-white" strokeWidth={3} />}
        />
        <span className="flex flex-1 flex-col">
          <span className="text-base leading-5">{token.symbol}</span>
          <span className="text-sm leading-5 text-text-2">{compact(token.mcap)} MC</span>
        </span>
        <span className="flex flex-col items-end">
          <span className="text-base leading-5">{usd(token.price)}</span>
          <span className="text-sm leading-5 text-text-2">
            <Pct value={alert.change1h} /> in 1h
          </span>
        </span>
      </Link>
    </li>
  );
}
