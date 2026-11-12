import { Button } from "@/components/ui/Button";
import type { Vote } from "@/lib/mock/votes";

type Props = { votes: Vote[]; members: number; canVote: boolean; onVote: (id: string, yes: boolean) => void };

export function OpenVotesCard({ votes, members, canVote, onVote }: Props) {
  return (
    <section className="p-4">
      <h2 className="text-xs font-bold tracking-wide text-text-2 uppercase">Open votes ({votes.length})</h2>
      {votes.map((v) => (
        <div key={v.id} className="mt-3 text-xs">
          <p>{v.title}</p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-panel-2">
            <div className="h-full bg-up" style={{ width: `${(v.yes / members) * 100}%` }} />
          </div>
          <p className="mt-1 text-xs text-text-2">
            {v.yes}/{members} yes · {v.endsIn}
          </p>
          {canVote && !v.voted && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button variant="up" onClick={() => onVote(v.id, true)}>
                Yes
              </Button>
              <Button variant="down-outline" onClick={() => onVote(v.id, false)}>
                No
              </Button>
            </div>
          )}
          {v.voted && <p className="mt-1 text-xs text-text-3">You voted</p>}
        </div>
      ))}
    </section>
  );
}
