import { Avatar } from "@/components/ui/Avatar";
import { compact, usd } from "@/lib/format";
import type { FactoryPakt, VaultState } from "@/lib/near/contracts";
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
        <button
          type="button"
          onClick={() => window.open(shareUrl(info.name), "_blank", "noopener,noreferrer")}
          className="mb-1 h-8 shrink-0 rounded-lg bg-accent px-3 text-xs font-medium text-white hover:brightness-110"
        >
          Share on 𝕏
        </button>
      </div>
      <p className="mt-3 flex gap-4 px-2 text-xs text-text-2">
        <span>◷ Since {since}</span>
        <span>⇄ {trades} trades</span>
        <span>{state.join_mode === "Open" ? "Open to join" : "Invite only"}</span>
      </p>
      <ul aria-label="On-chain limits" className="mt-3 flex flex-wrap gap-1.5 px-2 text-xs">
        {guards(info, state).map((g, i) => (
          <li key={g} className={`rounded-md px-2 py-0.5 ${i === 0 ? "bg-up-bg text-up" : "bg-chip text-text-2"}`}>{g}</li>
        ))}
      </ul>
    </header>
  );
}
