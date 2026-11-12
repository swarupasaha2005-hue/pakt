import { Avatar } from "@/components/ui/Avatar";
import { Pct } from "@/components/ui/Pct";
import { usd } from "@/lib/format";
import { me } from "@/lib/mock/me";

// shortcut: no dropdown yet, §10 account menu hooks in here
export function AccountPill() {
  return (
    <button type="button" className="flex h-12 items-center gap-6 rounded-xl border bg-panel pr-2 pl-2.5 text-left">
      <span className="flex flex-col">
        <span className="text-[15px] leading-5">{usd(me.total)}</span>
        <Pct value={me.change24h} className="text-[13px] leading-5" />
      </span>
      <Avatar name={me.account} size={32} />
    </button>
  );
}
