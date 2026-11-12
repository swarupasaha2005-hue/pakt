import type { PaktEvent } from "@/lib/api";
import { usd } from "@/lib/format";
import { e6, PRICE_SCALE, priceX } from "@/lib/pakt/units";

type SettledEvent = Extract<PaktEvent, { kind: "settled" }>;
const COLS = ["Date", "Profit", "Pakter fee", "Platform fee", "Members", "Share price"];

/** fee shares were minted at the new share price, so shares × price is their usd worth */
export function SettlementsTable({ rows }: { rows: SettledEvent[] }) {
  if (!rows.length) return <p className="py-8 text-center text-sm text-text-2">No settlements yet</p>;
  return (
    <table className="w-full text-xs">
      <thead className="text-xs text-text-2">
        <tr>
          {COLS.map((c, i) => (
            <th key={c} className={`py-2 ${i ? "text-right" : "text-left"}`}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const fee = (s: string) => (BigInt(s) * BigInt(r.data.share_price)) / PRICE_SCALE;
          const trader = fee(r.data.trader_fee_shares);
          const platform = fee(r.data.platform_fee_shares);
          const profit = BigInt(r.data.profit);
          return (
            <tr key={r.id} className="border-t text-right">
              <td className="py-2.5 text-left">{new Date(r.ts_ms).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
              <td className="text-up">+{usd(e6(profit))}</td>
              <td>{usd(e6(trader))}</td>
              <td>{usd(e6(platform))}</td>
              <td>+{usd(e6(profit - trader - platform))}</td>
              <td>{priceX(r.data.share_price).toFixed(4)}×</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
