"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import type { TokenInfo } from "@/lib/config";
import { ago, usd } from "@/lib/format";
import { paktName, type PaktInfo } from "@/lib/home/data";
import { amount, e6, nearblocks } from "@/lib/pakt/units";
import { impliedPrice, type TradeEvent } from "@/lib/token/data";

type Tab = "pakts" | "trades";
type Held = { pakt: PaktInfo; raw: string; value: number | null };
type Props = { token: TokenInfo; held?: Held[]; trades?: TradeEvent[]; now: number };

const COLS: Record<Tab, string[]> = {
  pakts: ["Pakt", "Trader", "Position", "Share of vault", "Fee"],
  trades: ["Trader", "Side", "Size", "Price", "Pakt"],
};

function PaktCell({ name }: { name: string }) {
  return <Link href={`/pakt/${name}`} className="text-accent hover:underline">{name}</Link>;
}

function Trader({ account, meta }: { account: string; meta: ReactNode }) {
  return (
    <span className="flex items-center gap-3">
      <Avatar name={account} size={32} />
      <span className="flex min-w-0 flex-col leading-5">
        <span className="truncate text-sm">{account}</span>
        <span className="flex items-center gap-1.5 text-xs text-text-2">{meta}</span>
      </span>
    </span>
  );
}

function Two({ top, bottom }: { top: ReactNode; bottom: ReactNode }) {
  return (
    <span className="flex flex-col leading-5">
      <span className="text-sm">{top}</span>
      <span className="text-xs text-text-2">{bottom}</span>
    </span>
  );
}

/** pakts holding the token (vault balances + at_dex) and its indexed trades */
export function HoldersTable({ token, held, trades, now }: Props) {
  const [tab, setTab] = useState<Tab>("pakts");
  const holding = held?.filter((h) => h.raw !== "0");

  const rows: Record<Tab, ReactNode[][] | undefined> = {
    pakts: holding?.map(({ pakt: p, raw, value }) => [
      <Link key="t" href={`/pakt/${p.name}`} className="block hover:underline">
        <Trader account={p.name} meta={`${p.members} members`} />
      </Link>,
      p.trader ? <span className="block truncate">{p.trader.account}</span> : <span className="text-text-3">hiring</span>,
      <Two key="p" top={value === null ? "—" : usd(value)} bottom={amount(token.id, raw)} />,
      value === null || !p.value ? "—" : `${((value / p.value) * 100).toFixed(1)}%`,
      p.trader ? <Badge key="f">{p.trader.fee_bps / 100}% fee</Badge> : <span className="text-text-3">—</span>,
    ]),
    trades: trades?.map((t) => {
      const buy = t.data.token_out === token.id;
      const raw = buy ? t.data.amount_out : t.data.amount_in;
      const price = impliedPrice(t, token.id, token.decimals);
      return [
        <Trader
          key="t"
          account={t.actor}
          meta={
            <a href={nearblocks(t.tx_hash)} target="_blank" rel="noreferrer" className="hover:text-text">
              {ago(Math.max(0, Math.round((now - t.ts_ms) / 1000)))} ago
            </a>
          }
        />,
        <Badge key="s" tone={buy ? "up" : "down"}>{buy ? "Buy" : "Sell"}</Badge>,
        <Two key="z" top={usd(e6(t.data.value))} bottom={amount(token.id, raw)} />,
        price === null ? "—" : usd(price),
        <PaktCell key="k" name={paktName(t.vault)} />,
      ];
    }),
  };
  const label: Record<Tab, string> = {
    pakts: `Pakts holding ${token.symbol}${holding ? ` (${holding.length})` : ""}`,
    trades: `Recent trades${trades ? ` (${trades.length})` : ""}`,
  };
  const list = rows[tab];

  return (
    <section className="shrink-0 overflow-hidden rounded-xl border bg-panel">
      <div className="flex h-[46px] items-center justify-between border-b px-3 text-sm">
        <Tabs items={(["pakts", "trades"] as const).map((id) => ({ id, label: label[id] }))} value={tab} onChange={setTab} className="h-[18px]" />
        {tab === "trades" && (
          <span className="flex items-center gap-1.5 text-xs text-text-2">
            <span className="size-1.5 rounded-full bg-up" /> live
          </span>
        )}
      </div>
      <table className="w-full table-fixed text-left">
        <colgroup>
          <col className="w-[205px]" />
          <col className="w-[144px]" />
          <col className="w-[124px]" />
          <col className="w-[113px]" />
          <col />
        </colgroup>
        <thead className="text-xs text-text-2">
          <tr className="h-[38px] border-b">
            {COLS[tab].map((c) => (
              <th key={c} className="px-3">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list?.map((cells, i) => (
            <tr key={i} className="h-[55px] hover:bg-panel-2/60">
              {cells.map((c, j) => (
                <td key={j} className="px-3 text-sm">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!list ? (
        <p className="py-8 text-center text-sm text-text-2">Loading…</p>
      ) : (
        !list.length && <p className="py-8 text-center text-sm text-text-2">{tab === "pakts" ? `No pakt holds ${token.symbol} yet` : "No trades yet"}</p>
      )}
    </section>
  );
}
