"use client";

import Link from "next/link";
import { useState } from "react";
import { OfferCard } from "@/components/pakt/OfferCard";
import { Avatar } from "@/components/ui/Avatar";
import { usd } from "@/lib/format";
import { loadPakts, useLoad, useNow } from "@/lib/home/data";
import { vaultValue } from "@/lib/near/contracts";
import { e6, left } from "@/lib/pakt/units";

/** open pakter offers to this account; the account itself gets accept/decline, visitors a read-only list */
export function OffersCard({ account, isMe }: { account: string; isMe: boolean }) {
  const list = useLoad(loadPakts, []);
  const now = useNow();
  const [done, setDone] = useState<string[]>([]);
  const offers = (list.data ?? []).filter((p) => p.state.offer?.terms.account === account && now < p.state.offer.expires_ms && !done.includes(p.vault));
  if (!offers.length) return null;

  if (isMe)
    return offers.map((p) => (
      <OfferCard
        key={p.vault}
        offer={p.state.offer!}
        name={p.name}
        vault={p.vault}
        members={p.members}
        value={vaultValue(p.state, p.prices)}
        now={now}
        onDone={() => setDone((d) => [...d, p.vault])}
      />
    ));

  return (
    <section aria-label="Pakter offers" className="rounded-xl border px-3 py-2.5">
      <h2 className="text-xs font-bold tracking-wide text-text-2 uppercase">Open offers</h2>
      <ul className="mt-1.5 flex flex-col gap-1">
        {offers.map((p) => {
          const t = p.state.offer!.terms;
          return (
            <li key={p.vault}>
              <Link href={`/pakt/${p.name}`} className="flex items-center gap-2.5 rounded-lg p-1.5 hover:bg-panel-2">
                <Avatar name={p.name} size={28} />
                <span className="flex-1 text-sm">
                  {p.name} <span className="text-text-2">wants to hire</span>
                </span>
                <span className="text-right text-xs text-text-2">
                  {usd(e6(t.budget))} budget · {t.fee_bps / 100}% fee
                  <br />
                  expires in {left(p.state.offer!.expires_ms - now)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
