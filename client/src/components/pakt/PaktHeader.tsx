import { Avatar } from "@/components/ui/Avatar";
import { compact } from "@/lib/format";
import type { Pakt } from "@/lib/mock/types";

export function PaktHeader({ pakt, trades }: { pakt: Pakt; trades: number }) {
  const stats = [
    [pakt.members.length, "Members"],
    [compact(pakt.vaultValue), "Vault"],
  ] as const;
  return (
    <header className="border-b pb-4">
      <div className="h-[100px] rounded-2xl bg-panel-2" />
      <div className="-mt-4 flex items-end gap-3 px-2">
        <span className="rounded-full ring-4 ring-bg">
          <Avatar name={pakt.name} size={60} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">{pakt.name}</h1>
          <p className="truncate text-sm text-text-2">{pakt.id}.sputnik-dao.near</p>
        </div>
        {stats.map(([value, label]) => (
          <div key={label} className="w-20 text-center">
            <div className="text-base">{value}</div>
            <div className="text-[13px] text-text-2">{label}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 flex gap-4 px-2 text-[13px] text-text-2">
        <span>◷ Since Nov 2026</span>
        <span>⇄ {trades} trades</span>
        <span>⛨ Stop-loss {pakt.stopLoss}%</span>
        <span>{pakt.open ? "Open to join" : "Invite only"}</span>
      </p>
    </header>
  );
}
