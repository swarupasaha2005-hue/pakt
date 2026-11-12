import { feeSplit } from "@/lib/fees";
import { signed, usd } from "@/lib/format";
import type { Settlement } from "@/lib/mock/settlements";

const COLS = ["Date", "Profit", "Trader fee", "Platform fee", "Members", "High-water mark"];

export function SettlementsTable({ rows }: { rows: Settlement[] }) {
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
        {rows.toReversed().map((r, i) => {
          const fees = feeSplit(r.profit, r.fee);
          return (
            <tr key={rows.length - i} className="border-t text-right">
              <td className="py-2.5 text-left">{r.date}</td>
              <td className={r.profit < 0 ? "text-down" : "text-up"}>{signed(r.profit)}</td>
              <td>{usd(fees.trader)}</td>
              <td>{usd(fees.platform)}</td>
              <td>{signed(r.profit - fees.trader - fees.platform)}</td>
              <td>{usd(r.hwm)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
