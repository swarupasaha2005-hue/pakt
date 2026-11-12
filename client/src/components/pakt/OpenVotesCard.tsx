import { Button } from "@/components/ui/Button";
import type { Vote } from "@/lib/mock/votes";

type Props = { votes: Vote[]; members: number; canVote: boolean; connected: boolean; onConnect: () => void; onVote: (id: string, yes: boolean) => void };

export function OpenVotesCard({ votes, members, canVote, connected, onConnect, onVote }: Props) {
  const needed = Math.floor(members / 2) + 1;
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
            {v.yes + v.no} of {members} · needs {needed} · {v.endsIn}
          </p>
          {canVote && !v.voted && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button variant="up" onClick={() => onVote(v.id, true)}>
                For
              </Button>
              <Button variant="down-outline" onClick={() => onVote(v.id, false)}>
                Against
              </Button>
            </div>
          )}
          {!connected && v.status === "Open" && (
            <Button variant="primary" onClick={onConnect} className="mt-2 w-full">Connect to vote</Button>
          )}
          {v.voted && <p className="mt-1 text-xs text-text-3">You voted</p>}
        </div>
      ))}
    </section>
  );
}
