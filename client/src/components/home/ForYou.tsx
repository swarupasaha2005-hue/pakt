"use client";

import Link from "next/link";
import { CreatePaktButton } from "@/components/shell/CreatePaktButton";
import { openTour } from "@/components/tour/Tour";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { daoId } from "@/lib/config";
import { usd } from "@/lib/format";
import { loadHoldings, loadPakts, useLoad } from "@/lib/home/data";
import { getLastProposalId, getPolicy, getProposals } from "@/lib/near/contracts";
import { useWallet } from "@/lib/near/wallet";
import { voteRows } from "@/lib/pakt/votes";

type Item = { pakt: string; tag: string; text: string; tone: "accent" | "up" | "text" };

/** offers to you, open votes you haven't cast, pakts you trade for, then your holdings */
async function forYou(account: string): Promise<Item[]> {
  const [list, held] = await Promise.all([loadPakts(), loadHoldings(account)]);
  const offers = list
    .filter((p) => p.state.offer?.terms.account === account)
    .map((p): Item => ({ pakt: p.name, tag: "Offer", text: `${p.name} wants to hire you`, tone: "accent" }));
  const trading = list
    .filter((p) => p.state.trader?.account === account)
    .map((p): Item => {
      const t = p.state.trader!;
      return { pakt: p.name, tag: "Pakter", text: `${usd((Number(t.budget) - Number(t.budget_used)) / 1e6)} budget left`, tone: "accent" };
    });
  const votes = await Promise.all(
    held.filter((h) => h.member).map(async (h) => {
      const dao = daoId(h.pakt.name);
      const [policy, last] = await Promise.all([getPolicy(dao), getLastProposalId(dao)]);
      const ps = await getProposals(dao, Math.max(0, last - 20), 20);
      return voteRows(ps, policy, account, Date.now())
        .filter((v) => v.status === "Open" && !v.voted)
        .map((v): Item => ({ pakt: h.pakt.name, tag: "Vote", text: v.title, tone: "up" }));
    }),
  ).catch(() => []);
  const seats = held.map((h): Item => ({ pakt: h.pakt.name, tag: h.member ? "Member" : "Fee share", text: h.value === null ? "—" : usd(h.value), tone: "text" }));
  return [...offers, ...votes.flat(), ...trading, ...seats];
}

const TONE = { accent: "bg-accent-bg text-accent", up: "bg-up-bg text-up", text: "bg-chip text-text-2" };

/** top of Explore: what needs you, or the pitch when signed out */
export function ForYou() {
  const { accountId } = useWallet();
  const items = useLoad(accountId ? () => forYou(accountId) : null, [accountId]);

  if (!accountId) {
    return (
      <section data-tour="pins" className="flex shrink-0 flex-col gap-3 rounded-xl border bg-panel px-4 py-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="min-w-0">
          <h1 className="text-base font-medium">Pool money with friends. Hire a pakter: a trader who can never withdraw it.</h1>
          <p className="mt-0.5 text-xs text-text-2">Every pakt is a vault plus a DAO: members vote the pakter in and out, caps and a stop-loss are enforced on chain.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button onClick={openTour} className="text-sm! font-medium!">Site tour</Button>
          <CreatePaktButton />
        </div>
      </section>
    );
  }

  return (
    <section data-tour="pins" className="flex shrink-0 flex-col gap-2">
      <h2 className="px-1 text-xs font-medium text-text-2">For you</h2>
      <div className="flex h-[66px] gap-3 overflow-x-auto">
        {!items.data && !items.error ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-full w-56 shrink-0 rounded-xl" />)
        ) : !items.data?.length ? (
          <div className="flex items-center gap-3 rounded-xl border px-3 text-sm text-text-3">
            Nothing waiting on you. Join a pakt below or start your own.
          </div>
        ) : (
          items.data.map((it, i) => (
            <Link key={i} href={`/pakt/${it.pakt}`} className="flex w-56 shrink-0 animate-fade-in items-center gap-2.5 rounded-xl border px-3 hover:bg-panel-2">
              <Avatar name={it.pakt} size={32} />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {it.pakt}
                  <span className={`rounded px-1 text-[10px] leading-4 ${TONE[it.tone]}`}>{it.tag}</span>
                </span>
                <span className="truncate text-xs text-text-2">{it.text}</span>
              </span>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
