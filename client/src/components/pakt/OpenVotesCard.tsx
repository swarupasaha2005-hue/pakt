"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { vote } from "@/lib/near/contracts";
import { useTx } from "@/lib/pakt/tx";
import { left } from "@/lib/pakt/units";
import type { VoteRow } from "@/lib/pakt/votes";
import { TxStatus } from "./TxStatus";

type Props = {
  dao: string;
  votes: VoteRow[];
  /** dao members role size, and approvals needed to pass */
  members: number;
  needed: number;
  /** null = may vote, else why not */
  blocked: string | null;
  now: number;
  onDone: () => void;
};

/** the vote that passes also runs the vault call */
export function OpenVotesCard({ dao, votes, members, needed, blocked, now, onDone }: Props) {
  const tx = useTx(onDone);
  const [busy, setBusy] = useState<number | null>(null);
  const cast = (v: VoteRow, yes: boolean) => {
    setBusy(v.id);
    tx.run(vote(dao, v.proposal, yes ? "VoteApprove" : "VoteReject"));
  };
  return (
    <section className="p-4">
      <h2 className="text-xs font-bold tracking-wide text-text-2 uppercase">Open votes ({votes.length})</h2>
      {votes.map((v) => (
        <div key={v.id} className="mt-3 text-xs">
          <p>{v.title}</p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-panel-2">
            <div className="h-full bg-up" style={{ width: `${Math.min(100, (v.yes / needed) * 100)}%` }} />
          </div>
          <p className="mt-1 text-xs text-text-2">
            {v.yes}/{needed} yes needed of {members} · {v.no} no · {left(v.endsMs - now)} left
          </p>
          {v.voted ? (
            <p className="mt-1 text-xs text-text-3">You voted {v.voted.toLowerCase()}</p>
          ) : blocked ? (
            <p className="mt-1 text-xs text-text-3">{blocked}</p>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button variant="up" disabled={tx.pending} onClick={() => cast(v, true)}>
                Yes
              </Button>
              <Button variant="down-outline" disabled={tx.pending} onClick={() => cast(v, false)}>
                No
              </Button>
            </div>
          )}
          {busy === v.id && <TxStatus {...tx} done="Vote sent" />}
        </div>
      ))}
    </section>
  );
}
