"use client";

import { Badge } from "@/components/ui/Badge";
import { CalendarIcon, ClockIcon, PencilIcon, SendIcon, ShareIcon, SwapIcon } from "@/components/ui/icons";
import { signed } from "@/lib/format";
import type { Profile } from "@/lib/mock/profiles";
import { ProfileAvatar } from "./ProfileAvatar";

const iconButton = "flex size-8 items-center justify-center rounded-lg border bg-panel text-text hover:bg-panel-2";

type Props = {
  profile: Profile;
  /** set = own profile, shows edit controls */
  onEdit?: () => void;
};

export function ProfileHeader({ profile: p, onEdit }: Props) {
  const share = () => navigator.clipboard.writeText(location.href).catch(() => {});

  return (
    <header className="border-b pb-5">
      <div
        className="relative h-[120px] rounded-2xl bg-panel bg-cover bg-center"
        style={p.cover ? { backgroundImage: `url(${p.cover})` } : undefined}
      >
        {onEdit && (
          <button type="button" aria-label="Edit cover" onClick={onEdit} className="absolute right-3 bottom-3 flex size-7 items-center justify-center rounded-lg bg-panel-2 hover:bg-border">
            <PencilIcon className="size-3.5" />
          </button>
        )}
      </div>

      <div className="-mt-2.5 flex items-end gap-4 pl-2">
        <span className="relative rounded-full ring-4 ring-bg">
          <ProfileAvatar account={p.account} src={p.avatar} size={72} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl leading-6 font-medium">{p.name}</h1>
          <p className="flex items-center gap-1.5 text-[17px] leading-6 text-text-2">
            @{p.account}
            {p.x && (
              <a href={`https://x.com/${p.x}`} target="_blank" rel="noreferrer" aria-label={`X: @${p.x}`} className="text-sm hover:text-text">
                𝕏
              </a>
            )}
            {p.telegram && (
              <a href={`https://t.me/${p.telegram}`} target="_blank" rel="noreferrer" aria-label={`Telegram: @${p.telegram}`} className="hover:text-text">
                <SendIcon className="size-3.5" />
              </a>
            )}
          </p>
        </div>
        <dl className="flex gap-6 text-center">
          {(
            [
              ["Following", p.following],
              ["Followers", p.followers],
            ] as const
          ).map(([label, n]) => (
            <div key={label} className="flex flex-col-reverse">
              <dt className="text-[13px] text-text-2">{label}</dt>
              <dd className="text-base">{n.toLocaleString("en-US")}</dd>
            </div>
          ))}
        </dl>
        <div className="flex gap-2 pb-0.5">
          <button type="button" aria-label="Copy profile link" onClick={share} className={iconButton}>
            <ShareIcon className="size-4" />
          </button>
          {onEdit && (
            <button type="button" onClick={onEdit} className="h-8 rounded-lg border bg-panel px-3 text-[15px] font-semibold hover:bg-panel-2">
              Edit profile
            </button>
          )}
        </div>
      </div>

      {p.bio && <p className="mt-3 text-sm">{p.bio}</p>}
      <ul className="mt-3 flex flex-wrap items-center gap-4 text-sm text-text-2">
        <li className="flex items-center gap-1.5">
          <ClockIcon className="size-3.5" /> {p.avgHold ? `Avg hold ${p.avgHold}` : "No hold time"}
        </li>
        <li className="flex items-center gap-1.5">
          <SwapIcon className="size-3.5" /> {p.trades.toLocaleString("en-US")} trades
        </li>
        <li className="flex items-center gap-1.5">
          <CalendarIcon className="size-3.5" /> Joined {p.joined}
        </li>
        {p.openToHire && (
          <li>
            <Badge tone="up">Open to hire · {p.askingFee}%</Badge>
          </li>
        )}
      </ul>

      {p.record && (
        <section aria-label="Trader record" className="mt-4 grid max-w-[640px] grid-cols-4 rounded-xl border">
          {[
            ["Pakt PnL", <span key="pnl" className={p.record.pnl < 0 ? "text-down" : "text-up"}>{signed(p.record.pnl)}</span>],
            ["Win rate", `${p.record.winRate}%`],
            ["Pakts traded", p.record.pakts],
            ["Max drawdown", <span key="dd" className="text-down">-{p.record.maxDrawdown}%</span>],
          ].map(([label, value], i) => (
            <div key={i} className={`px-3 py-2 ${i > 0 ? "border-l" : ""}`}>
              <p className="text-[13px] text-text-2">{label}</p>
              <p className="text-base">{value}</p>
            </div>
          ))}
        </section>
      )}
    </header>
  );
}
