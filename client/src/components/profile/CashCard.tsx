import { DollarIcon } from "@/components/ui/icons";
import { usd } from "@/lib/format";
import type { Cash } from "@/lib/profile/load";
import { units } from "@/lib/profile/format";

/** wallet balances of the test tokens; unpriced tokens count as $0 in the total */
export function CashCard({ cash }: { cash: Cash[] }) {
  const total = cash.reduce((s, c) => s + (c.usd ?? 0), 0);
  return (
    <section className="flex h-16 items-center gap-3 rounded-xl border px-2.5">
      <span className="flex size-10 items-center justify-center rounded-full border">
        <DollarIcon className="size-5" />
      </span>
      <div className="flex-1">
        <p className="text-xs leading-5 text-text-2">Total cash</p>
        <p data-balance className="text-base leading-5">{usd(total)}</p>
      </div>
      <ul className="flex flex-col items-end text-xs leading-4 text-text-2">
        {cash.map((c) => (
          <li key={c.token.id}>
            <span className="text-text">{units(c.raw, c.token.decimals)}</span> {c.token.symbol}
          </li>
        ))}
      </ul>
    </section>
  );
}
