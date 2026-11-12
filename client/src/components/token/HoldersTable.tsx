"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Pct } from "@/components/ui/Pct";
import { Tabs } from "@/components/ui/Tabs";
import { ago, usd } from "@/lib/format";
import { following } from "@/lib/mock/following";
import { holders } from "@/lib/mock/holders";
import { pakts } from "@/lib/mock/pakts";
import { trades } from "@/lib/mock/trades";
import type { Token } from "@/lib/mock/types";
import { Checkbox } from "./Checkbox";

type Tab = "holders" | "trades" | "pakts";

const COLS: Record<Tab, string[]> = {
  holders: ["Trader", "Position", "PnL", "Avg. entry", "Pakt"],
  trades: ["Trader", "Side", "Size", "Price", "Pakt"],
  pakts: ["Pakt", "Trader", "Position", "Share of vault", "Fee"],
};

const paktOf = (id: string | null) => pakts.find((p) => p.id === id);

function PaktCell({ id }: { id: string | null }) {
  return id ? <Link href={`/pakt/${id}`} className="text-accent hover:underline">{id}</Link> : <span className="text-text-2">solo</span>;
}

function Trader({ account, meta }: { account: string; meta: ReactNode }) {
  return (
    <span className="flex items-center gap-3">
      <Avatar name={account} size={32} />
      <span className="flex flex-col leading-5">
        <span className="text-sm">{account}</span>
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

export function HoldersTable({ token }: { token: Token }) {
  const [tab, setTab] = useState<Tab>("holders");
  const [paktsOnly, setPaktsOnly] = useState(false);
  const [followingOnly, setFollowingOnly] = useState(false);

  const keep = (r: { account: string; paktId: string | null }) =>
    (!paktsOnly || r.paktId) && (!followingOnly || following.includes(r.account));
  const held = holders(token);
  const byPakt = held.filter((h) => h.paktId);

  const rows: Record<Tab, ReactNode[][]> = {
    holders: held.filter(keep).map((h) => {
      const value = h.amount * token.price;
      const pnl = value - h.amount * h.avgEntry;
      const fee = paktOf(h.paktId)?.fee;
      return [
        <Trader key="t" account={h.account} meta={<>{!!fee && <Badge>{fee}% fee</Badge>}◷ {ago(h.heldSeconds)}</>} />,
        <Two key="p" top={usd(value)} bottom={`${h.amount.toLocaleString("en-US", { maximumSignificantDigits: 4 })} ${token.symbol}`} />,
        <Two key="n" top={<span className={pnl < 0 ? "text-down" : "text-up"}>{pnl < 0 ? "-" : "+"}{usd(Math.abs(pnl))}</span>} bottom={<Pct value={(token.price / h.avgEntry - 1) * 100} />} />,
        usd(h.avgEntry),
        <PaktCell key="k" id={h.paktId} />,
      ];
    }),
    trades: trades(token).filter(keep).map((t) => [
      <Trader key="t" account={t.account} meta={`${ago(t.secondsAgo)} ago`} />,
      <Badge key="s" tone={t.side === "buy" ? "up" : "down"}>{t.side === "buy" ? "Buy" : "Sell"}</Badge>,
      usd(t.usd),
      usd(t.price),
      <PaktCell key="k" id={t.paktId} />,
    ]),
    pakts: byPakt.map((h) => {
      const p = paktOf(h.paktId)!;
      const value = h.amount * token.price;
      return [
        <Trader key="t" account={p.name} meta={`${p.members.length} members`} />,
        p.trader,
        <Two key="p" top={usd(value)} bottom={`${h.amount.toLocaleString("en-US", { maximumSignificantDigits: 4 })} ${token.symbol}`} />,
        `${((value / p.vaultValue) * 100).toFixed(1)}%`,
        <Badge key="f">{p.fee}% fee</Badge>,
      ];
    }),
  };
  const label: Record<Tab, string> = { holders: `Holders (${held.length})`, trades: "Trades", pakts: `Pakts (${new Set(byPakt.map((h) => h.paktId)).size})` };

  return (
    <section className="shrink-0 overflow-hidden rounded-xl border bg-panel">
      <div className="flex h-[46px] items-center justify-between border-b px-3 text-sm">
        <Tabs items={(["holders", "trades", "pakts"] as const).map((id) => ({ id, label: label[id] }))} value={tab} onChange={setTab} className="h-[18px]" />
        {tab !== "pakts" && (
          <div className="flex gap-4">
            <Checkbox label="Pakts only" checked={paktsOnly} onChange={setPaktsOnly} />
            <Checkbox label="Following only" checked={followingOnly} onChange={setFollowingOnly} />
          </div>
        )}
      </div>
      <table className="w-full table-fixed text-left">
        {/* column starts: 217 / 361 / 485 / 598px */}
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
          {rows[tab].map((cells, i) => (
            <tr key={i} className="h-[55px] hover:bg-panel-2/60">
              {cells.map((c, j) => (
                <td key={j} className="px-3 text-sm">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows[tab].length && <p className="py-8 text-center text-sm text-text-2">Nothing here yet</p>}
    </section>
  );
}
