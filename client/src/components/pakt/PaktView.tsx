"use client";

import { useState } from "react";
import { LeavePaktModal } from "@/components/modals/LeavePaktModal";
import { ProposeTraderModal } from "@/components/modals/ProposeTraderModal";
import { VoteModal, type VoteModalKind } from "@/components/modals/VoteModal";
import { RightPanel } from "@/components/shell/RightPanel";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { feeSplit } from "@/lib/fees";
import { feed } from "@/lib/mock/feed";
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

// shortcut: Join/Deposit add a flat $100 in local state, swap for the §17 deposit modal
const DEPOSIT = 100;

/** pakt page center + right; all actions mutate local mock state */
export function PaktView({ initial }: { initial: Pakt }) {
  const [pakt, setPakt] = useState(initial);
  const [rows, setRows] = useState(() => settlements.filter((s) => s.paktId === initial.id));
  const [hwm, setHwm] = useState(() => rows.at(-1)?.hwm ?? initial.vaultValue);
  const [votes, setVotes] = useState(() => allVotes.filter((v) => v.paktId === initial.id));
  const [offer, setOffer] = useState(() => offers.find((o) => o.paktId === initial.id && o.to === me.account) ?? null);
  const [paused, setPaused] = useState(!!initial.trader && 1 - initial.vaultValue / hwm >= initial.stopLoss / 100);
  const [tab, setTab] = useState<Tab>("members");
  const [modal, setModal] = useState<ModalKind | null>(null);

  const trades = feed.filter((e) => e.paktId === pakt.id && (e.kind === "buy" || e.kind === "sell"));
  const total = pakt.members.reduce((s, m) => s + m.shares, 0);
  const mine = pakt.members.find((m) => m.account === me.account);
  const share = mine ? mine.shares / total : null;
  const myValue = (share ?? 0) * pakt.vaultValue;
  const profit = Math.max(0, pakt.vaultValue - hwm);
  const split = feeSplit(profit, pakt.fee);
  const myFees = (share ?? 0) * (split.trader + split.platform);
  const open = votes.filter((v) => v.status === "Open");

  function settle() {
    setRows((r) => [...r, { paktId: pakt.id, date: "Today", profit: pakt.vaultValue - hwm, fee: pakt.fee, hwm: Math.max(hwm, pakt.vaultValue) }]);
    setHwm((h) => Math.max(h, pakt.vaultValue));
  }

  // deposits move the mark too, so they never count as profit
  function deposit() {
    setPakt((p) => ({
      ...p,
      vaultValue: p.vaultValue + DEPOSIT,
      members: mine
        ? p.members.map((m) => (m === mine ? { ...m, shares: m.shares + DEPOSIT } : m))
        : [...p.members, { account: me.account, shares: DEPOSIT }],
    }));
    setHwm((h) => h + DEPOSIT);
  }

  function leave() {
    const out = myValue - myFees;
    settle();
    setPakt((p) => ({ ...p, vaultValue: p.vaultValue - out, members: p.members.filter((m) => m !== mine) }));
    setHwm((h) => h - out);
    setModal(null);
  }

  function cast(id: string, yes: boolean) {
    const n = pakt.members.length;
    const v = votes.find((x) => x.id === id)!;
    const next: Vote = { ...v, voted: true, yes: v.yes + +yes, no: v.no + +!yes };
    if (next.yes > n / 2) {
      next.status = "Passed";
      setPakt((p) => ({ ...p, ...v.change }));
      if (v.kind !== "raise") setPaused(false);
    } else if (next.no >= n / 2) next.status = "Rejected";
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
        {offer && <OfferCard offer={offer} pakt={pakt} onAccept={accept} onDecline={() => setOffer(null)} />}
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
        <ShareCard share={share} value={myValue} pnl7d={(share ?? 0) * pakt.pnl7d} open={pakt.open} onLeave={() => setModal("leave")} onDeposit={deposit} />
        <TraderCard pakt={pakt} member={!!mine} onPropose={() => setModal("propose")} onRaise={() => setModal("raise")} onFire={() => setModal("fire")} />
        <SettlementCard profit={profit} fee={pakt.fee} onSettle={settle} />
        <OpenVotesCard votes={open} members={pakt.members.length} canVote={!!mine} onVote={cast} />
      </RightPanel>
      {modal === "propose" && <ProposeTraderModal pakt={pakt} onClose={() => setModal(null)} onSubmit={propose} />}
      {modal === "leave" && share !== null && (
        <LeavePaktModal name={pakt.name} share={share} value={myValue} fees={myFees} onClose={() => setModal(null)} onLeave={leave} />
      )}
      {(modal === "raise" || modal === "fire" || modal === "resume") && (
        <VoteModal pakt={pakt} kind={modal} onClose={() => setModal(null)} onSubmit={propose} />
      )}
    </>
  );
}
