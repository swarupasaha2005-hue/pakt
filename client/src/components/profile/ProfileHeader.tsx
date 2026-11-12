"use client";

import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ExternalIcon, ShareIcon } from "@/components/ui/icons";
import { NETWORK } from "@/lib/config";
import { compact, signed } from "@/lib/format";
import { e6 } from "@/lib/profile/format";
import type { ProfileData } from "@/lib/profile/load";
import { PixelBanner } from "./PixelBanner";

const iconButton = "flex size-8 items-center justify-center rounded-lg border bg-panel text-text hover:bg-panel-2";
const explorer = `https://${NETWORK === "testnet" ? "testnet." : ""}nearblocks.io/address/`;

/** everything here is derived from the account id or chain data; there is no editable profile */
export function ProfileHeader({ account, data }: { account: string; data?: ProfileData }) {
  const share = () => navigator.clipboard.writeText(location.href).catch(() => {});
  const t = data?.trader;
  const pnl = t ? e6(t.pnl) : 0;

  return (
    <header className="border-b pb-5">
      <div className="h-[120px] overflow-hidden rounded-xl bg-panel">
        <PixelBanner seed={account} />
      </div>

      <div className="-mt-2.5 flex items-end gap-4 pl-2">
        <span className="relative rounded-full ring-4 ring-bg">
          <Avatar name={account} size={72} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg leading-6 font-bold">{account}</h1>
          <p className="flex items-center gap-1.5 text-base leading-5 text-text-2">
            <a href={explorer + account} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs hover:text-text">
              Explorer <ExternalIcon className="size-3.5" />
            </a>
            {t && t.live > 0 && <Badge tone="up">Trading {t.live} live</Badge>}
          </p>
        </div>
        {data && (
          <dl className="flex gap-6 text-center">
            {(
              [
                ["Pakts", data.positions.length],
                ["Trades", t?.trades ?? 0],
              ] as const
            ).map(([label, n]) => (
              <div key={label} className="flex flex-col-reverse">
                <dt className="text-xs text-text-2">{label}</dt>
                <dd className="text-base leading-5">{n.toLocaleString("en-US")}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="flex gap-2 pb-0.5">
          <button type="button" aria-label="Copy profile link" onClick={share} className={iconButton}>
            <ShareIcon className="size-4" />
          </button>
        </div>
      </div>

      {t && (
        <section aria-label="Pakter record" className="mt-4 grid max-w-[640px] grid-cols-4 rounded-xl border">
          {[
            ["Pakt PnL", <span key="pnl" className={pnl < 0 ? "text-down" : "text-up"}>{signed(pnl)}</span>],
            ["Volume", compact(e6(t.volume))],
            ["Trades", t.trades.toLocaleString("en-US")],
            ["Pakts traded", new Set(t.pakts.map((p) => p.vault)).size],
          ].map(([label, value], i) => (
            <div key={i} className={`px-3 py-2 ${i > 0 ? "border-l" : ""}`}>
              <p className="text-xs text-text-2">{label}</p>
              <p className="text-base">{value}</p>
            </div>
          ))}
        </section>
      )}
    </header>
  );
}
