import type { ReactNode } from "react";
import { ORACLE, type TokenInfo } from "@/lib/config";
import { ago } from "@/lib/format";
import { tokenAmount } from "@/lib/home/data";
import type { PriceData } from "@/lib/near/contracts";
import { addressUrl, NAMES, WINDOWS, type Pool, type Stats } from "@/lib/token/data";

type Props = {
  token: TokenInfo;
  /** null = base token, no pool; undefined while loading */
  pool: Pool | null | undefined;
  poolError: boolean;
  oracle?: PriceData;
  now: number;
  stats?: Stats | null;
};

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <dt className="text-text-2">{label}</dt>
      <dd className="min-w-0 truncate text-right">{children}</dd>
    </div>
  );
}

const link = (id: string) => (
  <a href={addressUrl(id)} target="_blank" rel="noreferrer" className="text-accent hover:underline">
    {id}
  </a>
);

export function AboutCard({ token: t, pool, poolError, oracle, now, stats }: Props) {
  const fresh = oracle?.prices.find((p) => p.asset_id === t.id)?.price;
  // oracle timestamp is ns
  const updated = oracle ? Math.max(0, Math.round((now - Number(oracle.timestamp) / 1e6) / 1000)) : null;
  return (
    <section className="space-y-4 border-b p-4">
      <div>
        <h2 className="text-base font-medium">About {t.symbol}</h2>
        <p className="text-xs text-text-2">{NAMES[t.symbol] ?? t.symbol} · on the Pakt whitelist</p>
      </div>
      {stats && (
        <div className="grid grid-cols-4 gap-1.5">
          {(Object.keys(WINDOWS) as (keyof typeof WINDOWS)[]).map((w) => {
            const c = stats.change[w];
            return (
              <div key={w} className="flex h-12 flex-col items-center justify-center rounded-lg border text-xs">
                <span className="text-text-2">{w}</span>
                {c === null ? <span className="text-text-3">—</span> : <span className={c < 0 ? "text-down" : "text-up"}>{c < 0 ? "▾" : "▴"} {Math.abs(c).toFixed(2)}%</span>}
              </div>
            );
          })}
        </div>
      )}
      <dl className="space-y-2">
        <Item label="Decimals">{t.decimals}</Item>
        <Item label="Contract">{link(t.id)}</Item>
        <Item label="Ref pool">{t.pool === null ? <span className="text-text-3">base token</span> : `#${t.pool}`}</Item>
        {t.pool !== null && (
          <Item label="Reserves">
            {poolError ? (
              <span className="text-text-3">unavailable</span>
            ) : pool ? (
              <span className="flex flex-col">
                {pool.token_account_ids.map((id, i) => (
                  <span key={id}>{tokenAmount(id, pool.amounts[i])}</span>
                ))}
              </span>
            ) : (
              "…"
            )}
          </Item>
        )}
        <Item label="Oracle">{link(ORACLE)}</Item>
        <Item label="Oracle price">
          {!oracle ? "…" : fresh ? `updated ${ago(updated!)} ago` : <span className="text-down">stale</span>}
        </Item>
      </dl>
    </section>
  );
}
