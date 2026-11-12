"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DepositModal } from "@/components/modals/DepositModal";
import { LeavePaktModal } from "@/components/modals/LeavePaktModal";
import { ProposeTraderModal } from "@/components/modals/ProposeTraderModal";
import { VoteModal, type VoteModalKind } from "@/components/modals/VoteModal";
import { RightPanel } from "@/components/shell/RightPanel";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import type { PaktEvent } from "@/lib/api";
import { daoMembers, getDexOwed, getOwed, getPendingSync, sharesValue } from "@/lib/near/contracts";
import { useWallet } from "@/lib/near/wallet";
import { usePakt, useNow } from "@/lib/pakt/load";
import { recoveries } from "@/lib/pakt/recover";
import { e6, PRICE_SCALE, sharePrice } from "@/lib/pakt/units";
import { needed, voteRows } from "@/lib/pakt/votes";
import { MembersTable } from "./MembersTable";
import { OfferCard } from "./OfferCard";
import { OpenVotesCard } from "./OpenVotesCard";
import { OwedCard } from "./OwedCard";
import { PaktHeader } from "./PaktHeader";
import { RecoveryCard } from "./RecoveryCard";
import { SettlementCard } from "./SettlementCard";
import { SettlementsTable } from "./SettlementsTable";
import { ShareCard } from "./ShareCard";
import { TradePanel } from "./TradePanel";
import { TraderCard } from "./TraderCard";
import { TradesList } from "./TradesList";
import { ValueChart, type PricePoint } from "./ValueChart";
import { VotesList } from "./VotesList";

type Tab = "members" | "trades" | "votes" | "settlements";
type ModalKind = VoteModalKind | "propose" | "leave" | "deposit";
type Of<K extends PaktEvent["kind"]> = Extract<PaktEvent, { kind: K }>;

/** share price after each deposit (value·1e12/shares) and settlement, oldest first */
function pricePoints(events: PaktEvent[]): PricePoint[] {
  return events.toReversed().flatMap((e): PricePoint[] => {
    if (e.kind === "settled") return [[e.ts_ms, BigInt(e.data.share_price)]];
    if (e.kind === "deposit" && e.data.shares !== "0") return [[e.ts_ms, (BigInt(e.data.value) * PRICE_SCALE) / BigInt(e.data.shares)]];
    return [];
  });
}

/** pakt page center + right: chain views + indexed feed, every action a real tx */
export function PaktView({ name }: { name: string }) {
  const { data, error, refresh } = usePakt(name);
  const { accountId, signIn } = useWallet();
  const now = useNow();
  const [tab, setTab] = useState<Tab>("members");
  const [modal, setModal] = useState<ModalKind | null>(null);
  const [owed, setOwed] = useState<[string, string][]>([]);
  const [pendingSync, setPendingSync] = useState<string[]>([]);
  const vault = data?.info.vault;

  useEffect(() => {
    if (!vault || !accountId) return;
    // failed payouts and ious from a leave while funds sat at ref; `claim` takes both
    Promise.all([getOwed(vault, accountId), getDexOwed(vault, accountId)])
      .then(([a, b]) => setOwed([...a, ...b]))
      .catch(() => setOwed([]));
  }, [vault, accountId, data]);
  useEffect(() => {
    if (vault) getPendingSync(vault).then(setPendingSync).catch(() => setPendingSync([]));
  }, [vault, data]);

  if (data === undefined) {
    return (
      <main className="flex min-w-0 flex-1 flex-col gap-4">
        {error ? (
          <div role="alert" className="rounded-xl bg-warn-bg px-4 py-3 text-xs text-down">
            Could not load {name}: {error}. It may still be setting up; this page retries on new events.
          </div>
        ) : (
          <>
            <Skeleton className="h-[100px] rounded-2xl" />
            <Skeleton className="h-[240px] rounded-2xl" />
          </>
        )}
      </main>
    );
  }
  if (data === null) {
    return (
      <main className="flex min-w-0 flex-1 flex-col items-center justify-center gap-3 text-center">
        <h1 className="text-xl font-bold">No pakt named “{name}”</h1>
        <p className="text-xs text-text-2">Check the link, or create it yourself.</p>
        <Link href="/" className="text-xs font-bold text-accent hover:underline">
          Back to Explore
        </Link>
      </main>
    );
  }

  const { info, state, holders, prices, value, proposals, policy, events } = data;
  const holder = holders.find(([a]) => a === accountId)?.[1] ?? null;
  const daoMember = !!accountId && daoMembers(policy).includes(accountId);
  const share = holder && state.total_shares !== "0" ? Number(holder.shares) / Number(state.total_shares) : null;
  const myValue = holder && value !== null ? e6(sharesValue(holder.shares, state, value)) : null;
  const price = value === null ? null : sharePrice(value, state.total_shares);
  const hwm = BigInt(state.hwm);
  const profit = price !== null && price > hwm ? e6(((price - hwm) * BigInt(state.total_shares)) / PRICE_SCALE) : 0;
  const trades = events.filter((e): e is Of<"trade"> => e.kind === "trade");
  const settled = events.filter((e): e is Of<"settled"> => e.kind === "settled");
  const votes = voteRows(proposals, policy, accountId, now);
  const open = votes.filter((v) => v.status === "Open");
  const members = daoMembers(policy).length;
  const isTrader = !!accountId && state.trader?.account === accountId;
  const offerForMe = state.offer && state.offer.terms.account === accountId ? state.offer : null;
  const dueMs = state.last_settle_ms + state.settle_period_ms;
  const busy = state.op || state.draining ? "Vault busy, retry in a minute" : null;
  const joinBlocked =
    busy ?? (holder?.member ? null : state.join_mode === "Invite" ? "Invite only. Ask a member for the link." : state.members >= 100 ? "Pakt full" : null);
  const settleBlocked = !accountId
    ? "Connect wallet to settle"
    : state.total_shares === "0"
      ? "Empty vault"
      : now < dueMs
        ? "Settles after the period"
        : busy;
  const voteBlocked = !accountId ? "Connect wallet to vote" : daoMember ? null : "Only members vote";
  const fixes = recoveries(info.vault, state, now, accountId, pendingSync);
  const props = { name: info.name, vault: info.vault, dao: info.dao, onClose: () => setModal(null), onDone: refresh };

  const body = {
    members: <MembersTable holders={holders} state={state} value={value} />,
    trades: <TradesList trades={trades} now={now} />,
    votes: <VotesList votes={votes} now={now} />,
    settlements: <SettlementsTable rows={settled} />,
  }[tab];

  return (
    <>
      <main className="flex min-w-0 flex-1 flex-col gap-4 md:overflow-y-auto">
        <PaktHeader info={info} state={state} value={value} trades={trades.length} />
        {offerForMe && <OfferCard offer={offerForMe} name={info.name} vault={info.vault} members={state.members} value={value} now={now} onDone={refresh} />}
        {state.trader?.paused && (
          <div role="alert" className="flex items-center gap-3 rounded-xl bg-warn-bg px-4 py-3 text-xs text-down">
            <span className="flex-1">Trading paused: vault hit the {state.trader.stop_loss_bps / 100}% stop-loss. Vote to resume or fire.</span>
            {daoMember && !state.fire_pending && (
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
        <ValueChart value={value} points={[...pricePoints(events), ...(price !== null ? [[now, price] as PricePoint] : [])]} hwm={hwm} />
        <section>
          <Tabs
            items={[
              { id: "members", label: `Members (${state.members})` },
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
        {isTrader && accountId && <TradePanel vault={info.vault} state={state} prices={prices} account={accountId} now={now} onDone={refresh} />}
        <div className="hidden md:block">
        <ShareCard
          share={share}
          value={myValue}
          joinBlocked={joinBlocked}
          signedIn={!!accountId}
          onSignIn={signIn}
          onLeave={() => setModal("leave")}
          onDeposit={() => setModal("deposit")}
        />
        </div>
        {fixes.length > 0 && <RecoveryCard fixes={fixes} onDone={refresh} />}
        {accountId && owed.length > 0 && <OwedCard vault={info.vault} account={accountId} owed={owed} onDone={refresh} />}
        <TraderCard state={state} member={daoMember} onPropose={() => setModal("propose")} onRaise={() => setModal("raise")} onFire={() => setModal("fire")} />
        <SettlementCard vault={info.vault} profit={profit} fee={(state.trader?.fee_bps ?? 0) / 100} dueMs={dueMs} now={now} blocked={settleBlocked} onDone={refresh} />
        <OpenVotesCard dao={info.dao} votes={open} members={members} needed={needed(policy, members)} blocked={voteBlocked} now={now} onDone={refresh} />
      </RightPanel>
      {/* phone: your share + deposit stay pinned above the bottom nav */}
      <div className="h-14 shrink-0 md:hidden" />
      <div className="fixed inset-x-0 bottom-16 z-20 border-t bg-panel px-3 py-2 md:hidden">
        <ShareCard
          bar
          share={share}
          value={myValue}
          joinBlocked={joinBlocked}
          signedIn={!!accountId}
          onSignIn={signIn}
          onLeave={() => setModal("leave")}
          onDeposit={() => setModal("deposit")}
        />
      </div>
      {modal === "deposit" && <DepositModal to={info.name} onClose={() => setModal(null)} onDone={refresh} />}
      {modal === "propose" && (
        <ProposeTraderModal {...props} members={holders.filter(([, h]) => h.member).map(([a]) => a)} stopLossBps={info.stop_loss_bps} />
      )}
      {modal === "leave" && holder && <LeavePaktModal {...props} state={state} shares={holder.shares} value={value} />}
      {(modal === "raise" || modal === "fire" || modal === "resume") && <VoteModal {...props} kind={modal} trader={state.trader} />}
    </>
  );
}
