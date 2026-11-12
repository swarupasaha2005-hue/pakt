import { Button } from "@/components/ui/Button";
import { usd } from "@/lib/format";

type Props = {
  /** null = not a member */
  share: number | null;
  value: number;
  pnl7d: number;
  open: boolean;
  onLeave: () => void;
  onDeposit: () => void;
};

export function ShareCard({ share, value, pnl7d, open, onLeave, onDeposit }: Props) {
  if (share === null) {
    return (
      <section className="border-b p-4">
        {open ? (
          <Button variant="primary" size="lg" className="w-full" onClick={onDeposit}>
            Join pakt
          </Button>
        ) : (
          <p className="text-center text-sm text-text-2">Invite only. Ask a member for the link.</p>
        )}
      </section>
    );
  }
  return (
    <section className="border-b p-4">
      <h2 className="text-sm text-text-2">Your share</h2>
      <p className="mt-1 text-[28px] leading-9">
        {usd(value)} <span className="text-base text-text-2">({(share * 100).toFixed(1)}%)</span>
      </p>
      <p className={`text-sm ${pnl7d < 0 ? "text-down" : "text-up"}`}>
        {pnl7d < 0 ? "▼" : "▲"} {usd(Math.abs(pnl7d))} 7D
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button onClick={onLeave}>Leave</Button>
        <Button variant="primary" onClick={onDeposit}>
          Deposit
        </Button>
      </div>
    </section>
  );
}
