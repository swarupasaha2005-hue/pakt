import Link from "next/link";
import type { ComponentProps } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import type { EventKind, PaktEvent } from "@/lib/api";
import { BASE_TOKEN } from "@/lib/config";
import { ago, usd } from "@/lib/format";
import { paktName, tokenAmount, usdNum } from "@/lib/home/data";

type Tone = ComponentProps<typeof Badge>["tone"];
/** kinds shown in the feed; the rest are vault bookkeeping */
export const SHOWN: EventKind[] = ["pakt_created", "deposit", "leave", "offer", "hired", "declined", "fired", "fire_pending", "cap_set", "trade", "settled", "paused", "resumed", "claim"];

const $ = (e6: string) => usd(usdNum(e6));

function describe(e: PaktEvent): [string, Tone, string] {
  switch (e.kind) {
    case "trade": {
      const buy = e.data.token_in === BASE_TOKEN.id;
      return buy
        ? ["Buy", "up", `Bought ${tokenAmount(e.data.token_out, e.data.amount_out)} for ${$(e.data.value)}`]
        : ["Sell", "down", `Sold ${tokenAmount(e.data.token_in, e.data.amount_in)} for ${$(e.data.value)}`];
    }
    case "pakt_created": return ["Created", "accent", `Created ${e.data.name} · ${e.data.join_mode === "Open" ? "open" : "invite only"}`];
    case "deposit": return ["Joined", "neutral", `Deposited ${$(e.data.value)}`];
    case "leave": return ["Left", "neutral", `Withdrew ${e.data.payouts.map((p) => tokenAmount(p.token, p.amount)).join(" + ") || "nothing"}`];
    case "offer": return ["Offer", "accent", `Offered ${e.data.trader} · ${$(e.data.budget)} budget · ${e.data.fee_bps / 100}% fee`];
    case "hired": return ["Hired", "up", `Hired ${e.data.trader}`];
    case "declined": return ["Declined", "neutral", `${e.data.trader} declined the offer`];
    case "fired": return ["Fired", "down", `Fired ${e.data.trader}`];
    case "fire_pending": return ["Firing", "down", `Firing ${e.data.trader} once trades unwind`];
    case "cap_set": return ["Caps", "accent", `Budget ${$(e.data.budget)} · max ${$(e.data.max_per_trade)} per trade`];
    case "settled": return ["Settled", "accent", `Share price ${usd(Number(e.data.share_price) / 1e12)} · profit ${$(e.data.profit)}`];
    case "paused": return e.data.reason === "stop_loss" ? ["Stop-loss", "down", "Trader paused by stop-loss"] : ["Paused", "down", `Paused: ${e.data.reason}`];
    case "resumed": return ["Resumed", "up", "Trader resumed"];
    case "claim": return ["Claim", "neutral", `Claimed ${tokenAmount(e.data.token, e.data.amount)}`];
    default: return [e.kind, "neutral", ""];
  }
}

export function FeedRow({ event, now }: { event: PaktEvent; now: number }) {
  const [label, tone, detail] = describe(event);
  const name = paktName(event.vault);
  const byPakt = event.actor === event.vault;

  return (
    <li className="flex gap-2 border-b px-3 py-3">
      <Avatar name={byPakt ? name : event.actor} size={28} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <Link href={byPakt ? `/pakt/${name}` : `/u/${event.actor}`} className="truncate text-sm leading-5 hover:underline">
            {byPakt ? name : event.actor}
          </Link>
          <Badge tone={tone}>{label}</Badge>
          <span className="ml-auto text-xs text-text-3">{ago(Math.max(0, Math.floor((now - event.ts_ms) / 1000)))}</span>
        </div>
        <p className="text-xs leading-5 text-text-2">
          {!byPakt && <><Link href={`/pakt/${name}`} className="text-text hover:underline">{name}</Link> · </>}
          {detail}
        </p>
      </div>
    </li>
  );
}
