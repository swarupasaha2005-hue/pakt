"use client";

import Link from "next/link";
import { Pnl } from "@/components/profile/PositionsCard";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { ago, signed, usd } from "@/lib/format";
import { loadHoldings, paktName, useLoad, useNow, type Holding } from "@/lib/home/data";
import { useWallet } from "@/lib/near/wallet";
import { costBasis } from "@/lib/profile/cost";
import { accountHistory } from "@/lib/profile/load";

type Seat = Holding & { cost: number | null; pct: number };

/** open seats with cost basis, plus pakts this account left and holds nothing in now */
async function seats(account: string) {
  const [held, history] = await Promise.all([loadHoldings(account), accountHistory(account)]);
  const costs = costBasis(history, account);
  const open: Seat[] = held.map((h) => {
    const total = Number(h.pakt.state.total_shares);
    return { ...h, cost: costs.get(h.pakt.vault) ?? null, pct: total ? (Number(h.shares) / total) * 100 : 0 };
  });
  const lastLeave = new Map(history.filter((e) => e.kind === "leave").map((e) => [e.vault, e.ts_ms] as const));
  const past = [...lastLeave].filter(([v]) => !held.some((h) => h.pakt.vault === v));
  return { open, past };
}

function SeatCard({ s }: { s: Seat }) {
  const t = s.pakt.trader;
  return (
    <Link href={`/pakt/${s.pakt.name}`} className="block rounded-xl border p-3 transition-colors hover:bg-panel-2/60">
      <div className="flex items-center gap-2.5">
        <Avatar name={s.pakt.name} size={28} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.pakt.name}</span>
        <span className={`rounded px-1.5 text-[10px] leading-4 ${s.member ? "bg-accent-bg text-accent" : "bg-chip text-text-2"}`}>
          {s.member ? "Member" : "Fee share"}
        </span>
        <span className="w-20 text-right text-sm tabular-nums">{s.value === null ? "—" : usd(s.value)}</span>
      </div>
      <div className="mt-2.5 flex items-center gap-2 text-xs text-text-2">
        <span className="h-1 flex-1 overflow-hidden rounded-full bg-chip">
          <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(2, Math.min(100, s.pct))}%` }} />
        </span>
        <span className="tabular-nums">{s.pct.toFixed(1)}% of vault</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs">
        <span className="truncate text-text-3">{t ? `Traded by ${t.account.replace(/\.testnet$/, "")} · ${t.fee_bps / 100}% fee` : "No pakter yet"}</span>
        <span className="tabular-nums"><Pnl value={s.value} cost={s.cost} /></span>
      </div>
    </Link>
  );
}

/** Positions tab: your shares in pakts with value and P/L, then pakts you left */
export function Positions() {
  const { accountId } = useWallet();
  const now = useNow();
  const res = useLoad(accountId ? () => seats(accountId) : null, [accountId]);

  let body;
  if (!accountId) {
    body = <p className="pt-6 text-center text-sm text-text-2">Connect a wallet to see your positions</p>;
  } else if (res.error) {
    body = <p className="pt-6 text-center text-sm text-text-2">Could not load your positions</p>;
  } else if (!res.data) {
    body = <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-[92px] rounded-xl" />)}</div>;
  } else {
    const { open, past } = res.data;
    const value = open.reduce((a, s) => a + (s.value ?? 0), 0);
    const priced = open.filter((s) => s.value !== null && s.cost !== null);
    const pnl = priced.reduce((a, s) => a + s.value! - s.cost!, 0);
    body = (
      <>
        <p className="flex items-baseline gap-2 px-1 text-xs text-text-2">
          <span className="text-base font-medium text-text tabular-nums">{usd(value)}</span>
          in {open.length} {open.length === 1 ? "pakt" : "pakts"}
          {priced.length > 0 && <span className={pnl > 0.005 ? "text-up" : pnl < -0.005 ? "text-down" : ""}>{Math.abs(pnl) < 0.005 ? "$0.00" : signed(pnl)} P/L</span>}
        </p>
        {open.length ? (
          <ul className="mt-3 space-y-2">{open.map((s) => <li key={s.pakt.vault}><SeatCard s={s} /></li>)}</ul>
        ) : (
          <p className="mt-3 rounded-xl border px-3 py-4 text-center text-sm text-text-2">No positions yet. Deposit into a pakt to open one.</p>
        )}
        {past.length > 0 && (
          <>
            <h3 className="mt-5 px-1 text-xs text-text-3">Past pakts</h3>
            <ul className="mt-1">
              {past.map(([vault, ts]) => (
                <li key={vault}>
                  <Link href={`/pakt/${paktName(vault)}`} className="flex h-9 items-center gap-2 rounded-lg px-1 text-xs hover:bg-panel-2/60">
                    <Avatar name={paktName(vault)} size={18} />
                    <span className="flex-1 text-text-2">{paktName(vault)}</span>
                    <span className="text-text-3">left {ago(Math.floor((now - ts) / 1000))} ago</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </>
    );
  }

  return <section className="min-h-0 flex-1 overflow-y-auto px-3 py-3">{body}</section>;
}
