import { Button } from "@/components/ui/Button";
import { DollarIcon } from "@/components/ui/icons";
import { usd } from "@/lib/format";

export function CashCard({ cash, onDeposit }: { cash: number; onDeposit: () => void }) {
  return (
    <section className="flex h-16 items-center gap-3 rounded-xl border px-2.5">
      <span className="flex size-10 items-center justify-center rounded-full border">
        <DollarIcon className="size-5" />
      </span>
      <div className="flex-1">
        <p className="text-sm leading-5 text-text-2">Total cash</p>
        <p data-balance className="text-base leading-5">{usd(cash)}</p>
      </div>
      {/* shortcut: withdraw is visual only, flow lands with chain wiring */}
      <Button className="h-9! text-[15px]">Withdraw</Button>
      <Button variant="primary" onClick={onDeposit} className="h-9! text-[15px]">
        Deposit
      </Button>
    </section>
  );
}
