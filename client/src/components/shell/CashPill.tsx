import { usd } from "@/lib/format";
import { me } from "@/lib/mock/me";

// shortcut: no dropdown yet, §9 cash menu hooks in here
export function CashPill() {
  return (
    <button type="button" className="flex h-12 flex-col justify-center rounded-xl border bg-panel px-2.5 text-left">
      <span className="text-[15px] leading-5">
        {usd(me.cash)} <span className="text-text-2">cash</span>
      </span>
      <span className="text-sm leading-5 font-semibold text-accent">Deposit more</span>
    </button>
  );
}
