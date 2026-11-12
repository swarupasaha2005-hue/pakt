import { Button } from "@/components/ui/Button";
import { usd } from "@/lib/format";

type Props = {
  /** null = holds no shares */
  share: number | null;
  /** usd, null without prices */
  value: number | null;
  /** null = may join, else why not */
  joinBlocked: string | null;
  signedIn: boolean;
  onSignIn: () => void;
  onLeave: () => void;
  onDeposit: () => void;
  /** phone bottom bar: one row, no border */
  bar?: boolean;
};

export function ShareCard({ share, value, joinBlocked, signedIn, onSignIn, onLeave, onDeposit, bar }: Props) {
  if (bar) {
    if (!signedIn) return <Button variant="primary" size="lg" className="w-full" onClick={onSignIn}>Connect wallet to join</Button>;
    if (share === null)
      return joinBlocked ? (
        <p className="py-2 text-center text-xs text-text-2">{joinBlocked}</p>
      ) : (
        <Button variant="primary" size="lg" className="w-full" onClick={onDeposit}>Join pakt</Button>
      );
    return (
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 leading-tight">
          <span className="block text-xs text-text-2">Your share · {(share * 100).toFixed(1)}%</span>
          <span className="text-lg">{value === null ? "—" : usd(value)}</span>
        </p>
        <Button onClick={onLeave}>Leave</Button>
        <Button variant="primary" disabled={!!joinBlocked} onClick={onDeposit}>Deposit</Button>
      </div>
    );
  }
  if (!signedIn) {
    return (
      <section className="border-b p-4">
        <Button variant="primary" size="lg" className="w-full" onClick={onSignIn}>
          Connect wallet to join
        </Button>
      </section>
    );
  }
  if (share === null) {
    return (
      <section className="border-b p-4">
        {joinBlocked ? (
          <p className="text-center text-xs text-text-2">{joinBlocked}</p>
        ) : (
          <Button variant="primary" size="lg" className="w-full" onClick={onDeposit}>
            Join pakt
          </Button>
        )}
      </section>
    );
  }
  return (
    <section className="border-b p-4">
      <h2 className="text-xs text-text-2">Your share</h2>
      <p className="mt-1 text-[28px] leading-9">
        {value === null ? "—" : usd(value)} <span className="text-base text-text-2">({(share * 100).toFixed(1)}%)</span>
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button onClick={onLeave}>Leave</Button>
        <Button variant="primary" disabled={!!joinBlocked} title={joinBlocked ?? undefined} onClick={onDeposit}>
          Deposit
        </Button>
      </div>
    </section>
  );
}
