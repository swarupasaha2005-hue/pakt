"use client";

import { useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { usd } from "@/lib/format";
import { history } from "@/lib/mock/history";
import type { Range } from "@/lib/mock/types";

const RANGES = ["24H", "7D", "30D", "ALL"] as const;
const W = 600;
const H = 180;

type Props = { value: number; pnl7d: number; hwm: number };

/** vault value area chart, dashed line = high-water mark */
export function ValueChart({ value, pnl7d, hwm }: Props) {
  const [range, setRange] = useState<Range>("7D");
  const series = history(value, pnl7d, range);
  const lo = Math.min(...series, hwm);
  const hi = Math.max(...series, hwm);
  const y = (v: number) => H - 8 - ((v - lo) / (hi - lo || 1)) * (H - 16);
  const line = series.map((v, i) => `${(i / (series.length - 1)) * W},${y(v)}`).join(" L");
  const change = value - series[0];
  const color = change < 0 ? "var(--down)" : "var(--up)";

  return (
    <section className="border-b pb-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[28px] leading-9">{usd(value)}</div>
          <div className={`text-xs ${change < 0 ? "text-down" : "text-up"}`}>
            {change < 0 ? "▼" : "▲"} {usd(Math.abs(change))} ({Math.abs((change / series[0]) * 100).toFixed(1)}%) <span className="text-text-2">{range}</span>
          </div>
        </div>
        <Segmented options={RANGES} value={range} onChange={setRange} />
      </div>
      <div className="relative mt-3">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[180px] w-full" role="img" aria-label={`Vault value, ${range}`}>
          <defs>
            <linearGradient id="vault-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.25" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`M${line} L${W},${H} L0,${H} Z`} fill="url(#vault-fill)" />
          <path d={`M${line}`} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <line x1="0" x2={W} y1={y(hwm)} y2={y(hwm)} stroke="var(--text-3)" strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="absolute right-0 -translate-y-full text-xs text-text-3" style={{ top: `${(y(hwm) / H) * 100}%` }}>
          High-water mark {usd(hwm)}
        </span>
      </div>
    </section>
  );
}
