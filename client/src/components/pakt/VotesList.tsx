import { Badge } from "@/components/ui/Badge";
import { left } from "@/lib/pakt/units";
import type { VoteRow, VoteStatus } from "@/lib/pakt/votes";

const TONE = { Open: "accent", Passed: "up", Rejected: "down", Expired: "neutral" } as const satisfies Record<VoteStatus, string>;

export function VotesList({ votes, now }: { votes: VoteRow[]; now: number }) {
  if (!votes.length) return <p className="py-8 text-center text-sm text-text-2">No votes yet</p>;
  return (
    <ul>
      {votes.map((v) => (
        <li key={v.id} className="flex items-center gap-3 border-t py-2.5 text-xs">
          <span className="flex-1">{v.title}</span>
          <span className="text-xs text-text-2">
            {v.yes} yes · {v.no} no{v.status === "Open" && ` · ${left(v.endsMs - now)} left`}
          </span>
          <Badge tone={TONE[v.status]}>{v.status}</Badge>
        </li>
      ))}
    </ul>
  );
}
