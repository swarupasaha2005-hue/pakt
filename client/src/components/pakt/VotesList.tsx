import { Badge } from "@/components/ui/Badge";
import type { Vote, VoteStatus } from "@/lib/mock/votes";

const TONE = { Open: "accent", Passed: "up", Rejected: "down", Expired: "neutral" } as const satisfies Record<VoteStatus, string>;

export function VotesList({ votes }: { votes: Vote[] }) {
  if (!votes.length) return <p className="py-8 text-center text-[15px] text-text-2">No votes yet</p>;
  return (
    <ul>
      {votes.map((v) => (
        <li key={v.id} className="flex items-center gap-3 border-t py-2.5 text-sm">
          <span className="flex-1">{v.title}</span>
          <span className="text-[13px] text-text-2">
            {v.yes} yes · {v.no} no · {v.endsIn}
          </span>
          <Badge tone={TONE[v.status]}>{v.status}</Badge>
        </li>
      ))}
    </ul>
  );
}
