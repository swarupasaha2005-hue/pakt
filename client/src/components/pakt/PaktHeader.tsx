import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { compact, usd } from "@/lib/format";
import type { FactoryPakt, VaultState } from "@/lib/near/contracts";
import { FeeSplitInfo } from "./FeeSplitInfo";
import { InviteByName } from "./InviteByName";
import { e6 } from "@/lib/pakt/units";

type Props = { info: FactoryPakt; state: VaultState; value: bigint | null; trades: number };

/** what the vault enforces, shown as chips; the first one is the headline guarantee */
function guards(info: FactoryPakt, state: VaultState) {
  const t = state.trader;
  const head = t ? "🔒 Pakter can't withdraw" : "🔒 Funds only leave to members";
  if (!t) return [head, `Stop-loss ${info.stop_loss_bps / 100}% for the next hire`];
  return [
    head,
    `Max ${usd(e6(t.max_per_trade))}/trade`,
    `Budget ${usd(e6(t.budget))}`,
    `Stop-loss ${t.stop_loss_bps / 100}%`,
    "2% oracle price floor",
    `Fee ${t.fee_bps / 100}% only above the high-water mark`,
  ];
}

/** x.com compose box with an invite line; the link unfurls into the pakt's share card */
const shareUrl = (name: string) => {
  const text = `Join my pakt "${name}" on Pakt. We pool tUSDC and vote in a pakter who can trade it but never withdraw it.`;
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(`${location.origin}/pakt/${name}`)}`;
};

export function PaktHeader({ info, state, value, trades }: Props) {
  const [inviting, setInviting] = useState(false);
  const stats = [
    [state.members, "Members"],
    [value === null ? "—" : compact(e6(value)), "Vault"],
  ] as const;
  const since = new Date(info.created_ms).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return (
    <header className="border-b pb-4">
      <div className="h-16 rounded-xl bg-panel-2 md:h-[100px]" />
      <div className="-mt-4 flex flex-wrap items-end gap-x-3 gap-y-3 px-2">
        <span className="rounded-full ring-4 ring-bg">
          <Avatar name={info.name} size={60} />
        </span>
        <div className="min-w-0 flex-1 basis-32">
          <h1 className="truncate text-xl font-bold">{info.name}</h1>
          <p className="truncate text-xs text-text-2">{info.dao}</p>
        </div>
        {stats.map(([v, label]) => (
          <div key={label} className="hidden w-20 text-center md:block">
            <div className="text-base">{v}</div>
            <div className="text-xs text-text-2">{label}</div>
          </div>
        ))}
        <span className="flex w-full gap-2 md:mb-1 md:w-auto">
        <button
          type="button"
          onClick={() => window.open(shareUrl(info.name), "_blank", "noopener,noreferrer")}
          className="h-9 flex-1 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:brightness-110 md:h-8 md:flex-none"
        >
          Share on 𝕏
        </button>
        <button type="button" onClick={() => setInviting(true)} className="h-9 flex-1 rounded-lg bg-panel-2 px-3 text-xs font-medium hover:bg-border md:h-8 md:flex-none">
          Invite
        </button>
        </span>
      </div>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 px-2 text-xs text-text-2">
        <span className="md:hidden">{state.members} members</span>
        <span>◷ Since {since}</span>
        <span>⇄ {trades} trades</span>
        <span>{state.join_mode === "Open" ? "Open to join" : "Invite only"}</span>
      </p>
      <ul aria-label="On-chain limits" className="mt-3 flex flex-wrap gap-1.5 px-2 text-xs">
        {guards(info, state).map((g, i) => (
          <li key={g} className={`rounded-md px-2 py-0.5 ${i === 0 ? "bg-up-bg text-up" : "bg-chip text-text-2"}`}>{g}</li>
        ))}
        <li className="flex items-center gap-0.5 rounded-md bg-chip pr-0.5 pl-2 text-text-2">
          Profit split
          <FeeSplitInfo fee={state.trader ? state.trader.fee_bps / 100 : undefined} className="right-0" />
        </li>
      </ul>
      <Modal open={inviting} onClose={() => setInviting(false)} label="Invite to pakt">
        <h2 className="text-lg font-medium">Invite to {info.name}</h2>
        <p className="mt-1 mb-4 text-xs text-text-2">Type NEAR account names. Each one gets a NEAR Social mention with the pakt link.</p>
        <InviteByName pakt={info.name} />
      </Modal>
    </header>
  );
}
