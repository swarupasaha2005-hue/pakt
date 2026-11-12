import Link from "next/link";
import type { ComponentProps } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ago } from "@/lib/format";
import type { FeedEvent, FeedKind } from "@/lib/mock/types";

const BADGES: Record<FeedKind, [string, ComponentProps<typeof Badge>["tone"]]> = {
  buy: ["Buy", "up"],
  sell: ["Sell", "down"],
  vote: ["Vote", "accent"],
  hired: ["Hired", "up"],
  fired: ["Fired", "down"],
  settled: ["Settled", "accent"],
  joined: ["Joined", "neutral"],
  left: ["Left", "neutral"],
  stoploss: ["Stop-loss", "down"],
};

export function FeedRow({ event }: { event: FeedEvent }) {
  const [label, tone] = BADGES[event.kind];
  const byPakt = event.actor === event.paktId;

  return (
    <li className="flex gap-2 border-b px-3 py-3">
      <Avatar name={event.actor} size={28} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <Link href={byPakt ? `/pakt/${event.paktId}` : `/profile/${event.actor}`} className="truncate text-sm leading-5 hover:underline">
            {event.actor}
          </Link>
          <Badge tone={tone}>{label}</Badge>
          <span className="ml-auto text-xs text-text-3">{ago(event.secondsAgo)}</span>
        </div>
        <p className="text-xs leading-5 text-text-2">
          {!byPakt && <><Link href={`/pakt/${event.paktId}`} className="text-text hover:underline">{event.paktId}</Link> · </>}
          {event.detail}
        </p>
        {event.kind === "vote" && (
          <Link href={`/pakt/${event.paktId}`} className="w-fit text-xs font-bold text-accent hover:underline">
            View vote
          </Link>
        )}
      </div>
    </li>
  );
}
