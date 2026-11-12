import { Avatar } from "@/components/ui/Avatar";
import { compact } from "@/lib/format";
import type { FactoryPakt, VaultState } from "@/lib/near/contracts";
import { e6 } from "@/lib/pakt/units";

type Props = { info: FactoryPakt; state: VaultState; value: bigint | null; trades: number };

export function PaktHeader({ info, state, value, trades }: Props) {
  const stats = [
    [state.members, "Members"],
    [value === null ? "—" : compact(e6(value)), "Vault"],
  ] as const;
  const since = new Date(info.created_ms).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return (
    <header className="border-b pb-4">
      <div className="h-[100px] rounded-xl bg-panel-2" />
      <div className="-mt-4 flex items-end gap-3 px-2">
        <span className="rounded-full ring-4 ring-bg">
          <Avatar name={info.name} size={60} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{info.name}</h1>
          <p className="truncate text-xs text-text-2">{info.dao}</p>
        </div>
        {stats.map(([v, label]) => (
          <div key={label} className="w-20 text-center">
            <div className="text-base">{v}</div>
            <div className="text-xs text-text-2">{label}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 flex gap-4 px-2 text-xs text-text-2">
        <span>◷ Since {since}</span>
        <span>⇄ {trades} trades</span>
        <span>⛨ Stop-loss {info.stop_loss_bps / 100}%</span>
        <span>{state.join_mode === "Open" ? "Open to join" : "Invite only"}</span>
      </p>
    </header>
  );
}
