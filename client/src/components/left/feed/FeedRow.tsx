import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import type { EventKind, PaktEvent } from "@/lib/api";
import { BASE_TOKEN, TOKENS } from "@/lib/config";
import { ago, compact, usd } from "@/lib/format";
import { LOGOS, paktName, usdNum } from "@/lib/home/data";

type Tone = ComponentProps<typeof Badge>["tone"];
/** kinds shown in the feed; the rest are vault bookkeeping */
export const SHOWN: EventKind[] = ["pakt_created", "deposit", "leave", "offer", "hired", "declined", "fired", "fire_pending", "cap_set", "trade", "settled", "paused", "resumed", "claim"];

const $ = (e6: string) => usd(usdNum(e6));
/** feed shows short names; the full id stays in the link and title */
export const short = (account: string) => account.replace(/\.testnet$/, "");
const tok = (id: string) => TOKENS.find((t) => t.id === id);
const units = (id: string, raw: string) => Number(raw) / 10 ** (tok(id)?.decimals ?? 0);
const qty = (id: string, raw: string) => units(id, raw).toLocaleString("en-US", { maximumSignificantDigits: 4 });

const dotted = "underline decoration-dotted decoration-text-3 underline-offset-4 hover:decoration-text";
const M = ({ children }: { children: ReactNode }) => <span className="text-text-3">{children}</span>;
const Pakt = ({ name }: { name: string }) => <Link href={`/pakt/${name}`} className={dotted}>{name}</Link>;
const Acct = ({ id }: { id: string }) => <Link href={`/u/${id}`} title={id} className={`truncate ${dotted}`}>{short(id)}</Link>;
function Tok({ id }: { id: string }) {
  const sym = tok(id)?.symbol ?? id;
  return (
    <Link href={`/token/${sym}`} className="inline-flex items-center gap-1">
      <Avatar name={sym} src={LOGOS[sym]} size={20} />
      <span className={dotted}>{sym}</span>
    </Link>
  );
}

const row = (label: string, tone: Tone, line: ReactNode): [string, Tone, ReactNode] => [label, tone, line];

/** badge + one short line, value-first like a ticker */
function describe(e: PaktEvent, name: string): [string, Tone, ReactNode] {
  const pakt = <><M>in</M> <Pakt name={name} /></>;
  switch (e.kind) {
    case "trade": {
      const buy = e.data.token_in === BASE_TOKEN.id;
      const [id, raw] = buy ? [e.data.token_out, e.data.amount_out] : [e.data.token_in, e.data.amount_in];
      const each = usdNum(e.data.value) / units(id, raw);
      return row(buy ? "Buy" : "Sell", buy ? "up" : "down", <><Tok id={id} /> {$(e.data.value)} <M>at</M> {Number.isFinite(each) ? compact(each) : "—"} {pakt}</>);
    }
    case "pakt_created": return row("Created", "accent", <><Pakt name={e.data.name} /> <M>{e.data.join_mode === "Open" ? "open to all" : "invite only"}</M></>);
    case "deposit": return row("Deposit", "up", <><Tok id={BASE_TOKEN.id} /> {$(e.data.value)} {pakt}</>);
    case "leave": {
      const [first, ...rest] = e.data.payouts.filter((p) => p.amount !== "0");
      return row("Left", "neutral", first
        ? <><Tok id={first.token} /> {qty(first.token, first.amount)}{rest.length > 0 && <M> +{rest.length} more</M>} <M>out of</M> <Pakt name={name} /></>
        : <><M>left</M> <Pakt name={name} /></>);
    }
    case "offer": return row("Offer", "accent", <><Acct id={e.data.trader} /> {$(e.data.budget)} <M>budget ·</M> {e.data.fee_bps / 100}% <M>fee</M> {pakt}</>);
    case "hired": return row("Hired", "cyan", <><Acct id={e.data.trader} /> <M>now trades</M> <Pakt name={name} /></>);
    case "declined": return row("Declined", "neutral", <><Acct id={e.data.trader} /> <M>passed on</M> <Pakt name={name} /></>);
    case "fired": return row("Fired", "down", <><Acct id={e.data.trader} /> <M>out of</M> <Pakt name={name} /></>);
    case "fire_pending": return row("Firing", "down", <><Acct id={e.data.trader} /> <M>leaves once trades unwind</M></>);
    case "cap_set": return row("Caps", "accent", <>{$(e.data.budget)} <M>budget ·</M> {$(e.data.max_per_trade)} <M>per trade</M></>);
    case "settled": {
      const p = usdNum(e.data.profit);
      return row("Settled", "accent", <><span className={p > 0 ? "text-up" : ""}>{p > 0 ? "+" : ""}{usd(p)}</span> <M>profit · share</M> {usd(Number(e.data.share_price) / 1e12)}</>);
    }
    case "paused": return row("Paused", "down", e.data.reason === "stop_loss" ? <M>stop-loss hit, trading paused</M> : <M>paused: {e.data.reason}</M>);
    case "resumed": return row("Resumed", "up", <M>trading resumed</M>);
    case "claim": return row("Claim", "neutral", <><Tok id={e.data.token} /> {qty(e.data.token, e.data.amount)} <M>claimed from</M> <Pakt name={name} /></>);
    default: return row(e.kind, "neutral", null);
  }
}

export function FeedRow({ event, now }: { event: PaktEvent; now: number }) {
  const name = paktName(event.vault);
  const [label, tone, line] = describe(event, name);
  const byPakt = event.actor === event.vault;
  const who = byPakt ? name : event.actor;

  return (
    <li className="flex gap-2 border-b px-2 py-4 transition-colors last:border-b-0 hover:bg-panel-2/60">
      <Avatar name={who} size={24} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex h-5 items-center gap-1">
          <Link href={byPakt ? `/pakt/${name}` : `/u/${who}`} title={who} className="truncate text-sm leading-5 font-medium hover:underline">
            {byPakt ? name : short(who)}
          </Link>
          <Badge tone={tone}>{label}</Badge>
          <span className="ml-auto shrink-0 text-xs font-medium text-text-3">{ago(Math.max(0, Math.floor((now - event.ts_ms) / 1000)))}</span>
        </div>
        <p className="flex min-h-6 flex-wrap items-center gap-x-1 text-sm leading-5 font-medium">{line}</p>
      </div>
    </li>
  );
}
