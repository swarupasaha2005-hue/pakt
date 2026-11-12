"use client";

import { useState } from "react";
import { LeavePaktModal } from "@/components/modals/LeavePaktModal";
import { DepositModal } from "@/components/modals/DepositModal";
import { ProposeTraderModal } from "@/components/modals/ProposeTraderModal";
import { VoteModal, type VoteModalKind } from "@/components/modals/VoteModal";
import { RightPanel } from "@/components/shell/RightPanel";
import { useMockSession } from "@/components/session/MockSessionProvider";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { feeSplit } from "@/lib/fees";
import { feed } from "@/lib/mock/feed";
import { holdings as seedHoldings, type Holding } from "@/lib/mock/holdings";
import { me } from "@/lib/mock/me";
import { offers } from "@/lib/mock/offers";
import { settlements } from "@/lib/mock/settlements";
import type { Pakt } from "@/lib/mock/types";
import { votes as allVotes, type NewVote, type Vote } from "@/lib/mock/votes";
import { MembersTable } from "./MembersTable";
import { OfferCard } from "./OfferCard";
import { OpenVotesCard } from "./OpenVotesCard";
import { PaktHeader } from "./PaktHeader";
import { SettlementCard } from "./SettlementCard";
import { SettlementsTable } from "./SettlementsTable";
import { ShareCard } from "./ShareCard";
import { TraderCard } from "./TraderCard";
import { TradesList } from "./TradesList";
import { ValueChart } from "./ValueChart";
import { VotesList } from "./VotesList";

type Tab = "members" | "trades" | "votes" | "settlements";
type ModalKind = VoteModalKind | "propose" | "leave";

function initialAssets(pakt: Pakt): Holding[] {
  const assets = seedHoldings.filter((holding) => holding.owner === pakt.id && holding.open);
  if (assets.length || pakt.vaultValue <= 0) return assets;
  return [{ id: `${pakt.id}-base`, owner: pakt.id, symbol: "USDC", amount: pakt.vaultValue, value: pakt.vaultValue, pnl: 0, pnlPct: 0, open: true }];
}

/** pakt page center + right; all actions mutate local mock state */
export function PaktView({ initial, hasInvite = false }: { initial: Pakt; hasInvite?: boolean }) {
  const { connected, requestConnect } = useMockSession();
  const [pakt, setPakt] = useState(initial);
  const [rows, setRows] = useState(() => settlements.filter((s) => s.paktId === initial.id));
  const [hwm, setHwm] = useState(() => rows.at(-1)?.hwm ?? initial.vaultValue);
  const [votes, setVotes] = useState(() => allVotes.filter((v) => v.paktId === initial.id));
  const [assets, setAssets] = useState(() => initialAssets(initial));
  const [offer, setOffer] = useState(() => offers.find((o) => o.paktId === initial.id && o.to === me.account) ?? null);
  const [paused, setPaused] = useState(!!initial.trader && 1 - initial.vaultValue / hwm >= initial.stopLoss / 100);
  const [tab, setTab] = useState<Tab>("members");
  const [modal, setModal] = useState<ModalKind | null>(null);
  const [depositing, setDepositing] = useState(false);

  const trades = feed.filter((e) => e.paktId === pakt.id && (e.kind === "buy" || e.kind === "sell"));
  const total = pakt.members.reduce((s, m) => s + m.shares, 0);
  const mine = connected ? pakt.members.find((m) => m.account === me.account) : undefined;
  const share = mine ? mine.shares / total : null;
  const myValue = (share ?? 0) * pakt.vaultValue;
  const profit = Math.max(0, pakt.vaultValue - hwm);
  const split = feeSplit(profit, pakt.fee);
  const myFees = (share ?? 0) * (split.trader + split.platform);
  const open = votes.filter((v) => v.status === "Open");
  const canJoin = pakt.open || hasInvite;

  function settle() {
    setRows((r) => [...r, { paktId: pakt.id, date: "Today", profit: pakt.vaultValue - hwm, fee: pakt.fee, hwm: Math.max(hwm, pakt.vaultValue) }]);
    setHwm((h) => Math.max(h, pakt.vaultValue));
  }

  // deposits move the mark too, so they never count as profit
  function deposit(amount: number, destination: string) {
    if (destination !== pakt.id) {
      if (destination === "wallet") me.cash += amount;
      setDepositing(false);
      return;
    }
    me.cash = Math.max(0, me.cash - amount);
    setPakt((p) => ({
      ...p,
      vaultValue: p.vaultValue + amount,
      members: mine
        ? p.members.map((m) => (m === mine ? { ...m, shares: m.shares + amount } : m))
        : [...p.members, { account: me.account, shares: amount }],
    }));
    setHwm((h) => h + amount);
    setAssets((current) => {
      const usdc = current.find((holding) => holding.symbol === "USDC");
      if (usdc) return current.map((holding) => holding === usdc ? { ...holding, amount: holding.amount + amount, value: holding.value + amount } : holding);
      return [...current, { id: `${pakt.id}-deposit`, owner: pakt.id, symbol: "USDC", amount, value: amount, pnl: 0, pnlPct: 0, open: true }];
    });
    setDepositing(false);
  }

  function leave() {
    const out = Math.max(0, myValue - myFees);
    const fraction = pakt.vaultValue ? out / pakt.vaultValue : 0;
    settle();
    setPakt((p) => ({ ...p, vaultValue: p.vaultValue - out, members: p.members.filter((m) => m !== mine) }));
    setAssets((current) => current.map((holding) => ({
      ...holding,
      amount: holding.amount * (1 - fraction),
      value: holding.value * (1 - fraction),
    })));
    setHwm((h) => h - out);
    setModal(null);
  }

  function cast(id: string, yes: boolean) {
    if (!connected || !mine) return;
    const n = pakt.members.length;
    const v = votes.find((x) => x.id === id && x.status === "Open" && !x.voted);
    if (!v) return;
    const next: Vote = { ...v, voted: true, yes: v.yes + +yes, no: v.no + +!yes };
    const needed = Math.floor(n / 2) + 1;
    if (next.yes >= needed) {
      next.status = "Passed";
      setPakt((p) => ({ ...p, ...v.change }));
      if (v.kind !== "raise") setPaused(false);
    } else if (next.no >= needed) next.status = "Rejected";
    setVotes((list) => list.map((x) => (x.id === id ? next : x)));
  }

  const propose = (v: NewVote) =>
    setVotes((list) => [{ ...v, id: `new-${list.length}`, paktId: pakt.id, yes: 0, no: 0, endsIn: "3d left", status: "Open" }, ...list]);

  function accept() {
    if (!offer) return;
    setPakt((p) => ({ ...p, trader: me.account, budget: offer.budget, budgetUsed: 0, maxPerTrade: offer.maxPerTrade, stopLoss: offer.stopLoss, fee: offer.fee }));
    setOffer(null);
  }

  const body = {
    members: <MembersTable pakt={pakt} />,
    trades: <TradesList trades={trades} />,
    votes: <VotesList votes={votes} />,
    settlements: <SettlementsTable rows={rows} />,
  }[tab];

  return (
    <>
      <main className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto">
        <PaktHeader pakt={pakt} trades={trades.length} />
        {connected && offer && <OfferCard offer={offer} pakt={pakt} onAccept={accept} onDecline={() => setOffer(null)} />}
        {paused && pakt.trader && (
          <div role="alert" className="flex items-center gap-3 rounded-xl bg-warn-bg px-4 py-3 text-xs text-down">
            <span className="flex-1">
              Trading paused: vault down {pakt.stopLoss}%. Vote to resume or fire.
            </span>
            {mine && (
              <>
                <Button size="sm" onClick={() => setModal("resume")}>
                  Resume
                </Button>
                <Button size="sm" variant="down" onClick={() => setModal("fire")}>
                  Fire
                </Button>
              </>
            )}
          </div>
        )}
        <ValueChart value={pakt.vaultValue} pnl7d={pakt.pnl7d} hwm={hwm} />
        <section>
          <Tabs
            items={[
              { id: "members", label: `Members (${pakt.members.length})` },
              { id: "trades", label: "Trades" },
              { id: "votes", label: "Votes" },
              { id: "settlements", label: "Settlements" },
            ]}
            value={tab}
            onChange={setTab}
            className="mb-2 h-[18px] text-sm"
          />
          {body}
        </section>
      </main>
      <RightPanel>
        <ShareCard share={share} value={myValue} pnl7d={(share ?? 0) * pakt.pnl7d} open={canJoin} connected={connected} onLeave={() => setModal("leave")} onDeposit={() => setDepositing(true)} onConnect={requestConnect} />
        <TraderCard pakt={pakt} member={connected && !!mine} onPropose={() => setModal("propose")} onRaise={() => setModal("raise")} onFire={() => setModal("fire")} />
        <SettlementCard profit={profit} fee={pakt.fee} connected={connected} onSettle={settle} onConnect={requestConnect} />
        <OpenVotesCard votes={open} members={pakt.members.length} canVote={connected && !!mine} connected={connected} onConnect={requestConnect} onVote={cast} />
      </RightPanel>
      {modal === "propose" && <ProposeTraderModal pakt={pakt} onClose={() => setModal(null)} onSubmit={propose} />}
      {modal === "leave" && share !== null && (
        <LeavePaktModal name={pakt.name} share={share} value={myValue} fees={myFees} holdings={assets} onClose={() => setModal(null)} onLeave={leave} />
      )}
      {depositing && <DepositModal to={pakt.id} pakt={pakt} onClose={() => setDepositing(false)} onDeposit={deposit} />}
      {(modal === "raise" || modal === "fire" || modal === "resume") && (
        <VoteModal pakt={pakt} kind={modal} onClose={() => setModal(null)} onSubmit={propose} />
      )}
    </>
  );
}
