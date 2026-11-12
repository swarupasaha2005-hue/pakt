import { usd } from "@/lib/format";
import { e6, priceX } from "@/lib/pakt/units";

const W = 600;
const H = 180;

/** [ts_ms, share price usd e6 per 1e12 shares], oldest first */
export type PricePoint = [number, bigint];

type Props = { value: bigint | null; points: PricePoint[]; hwm: bigint };

/** share price steps from deposits and settlements, dashed line = high-water mark */
export function ValueChart({ value, points, hwm }: Props) {
  const head = <div className="text-[28px] leading-9">{value === null ? "—" : usd(e6(value))}</div>;
  if (!points.length) {
    return (
      <section className="border-b pb-4">
        {head}
        <p className="py-8 text-center text-sm text-text-2">No deposits yet</p>
      </section>
    );
  }
  const ps = points.map(([, p]) => priceX(p));
  const mark = priceX(hwm);
  const first = ps[0];
  const last = ps.at(-1)!;
  const lo = Math.min(...ps, mark || last);
  const hi = Math.max(...ps, mark);
  const t0 = points[0][0];
  const span = points.at(-1)![0] - t0 || 1;
  const x = (t: number) => ((t - t0) / span) * W;
  const y = (v: number) => H - 8 - ((v - lo) / (hi - lo || 1)) * (H - 16);
  const steps = points.length === 1 ? `M0,${y(last)} H${W}` : `M0,${y(first)}` + points.slice(1).map(([t], i) => ` H${x(t)} V${y(ps[i + 1])}`).join("");
  const change = last / first - 1;
  const color = change < 0 ? "var(--down)" : "var(--up)";

  return (
    <section className="border-b pb-4">
      {head}
      <div className={`text-xs ${change < 0 ? "text-down" : "text-up"}`}>
        {change < 0 ? "▼" : "▲"} {Math.abs(change * 100).toFixed(2)}% <span className="text-text-2">share price since first deposit · now {last.toFixed(4)}×</span>
      </div>
      <div className="relative mt-3">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[180px] w-full" role="img" aria-label="Share price history">
          <defs>
            <linearGradient id="vault-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.25" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${steps} V${H} H0 Z`} fill="url(#vault-fill)" />
          <path d={steps} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {mark > 0 && <line x1="0" x2={W} y1={y(mark)} y2={y(mark)} stroke="var(--text-3)" strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />}
        </svg>
        {mark > 0 && (
          <span className="absolute right-0 -translate-y-full text-xs text-text-3" style={{ top: `${(y(mark) / H) * 100}%` }}>
            High-water mark {mark.toFixed(4)}×
          </span>
        )}
      </div>
    </section>
  );
}
