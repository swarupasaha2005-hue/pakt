"use client";

import { useId, useState } from "react";
import { Pct } from "@/components/ui/Pct";
import { usd } from "@/lib/format";
import { valueSeries, type Profile } from "@/lib/mock/profiles";
import type { Range } from "@/lib/mock/types";
import { ChipGroup } from "./ChipGroup";

const RANGES = ["24H", "7D", "30D", "ALL"] as const satisfies readonly Range[];
const W = 600;
const H = 200;

export function ValueChart({ profile }: { profile: Profile }) {
  const [range, setRange] = useState<Range>("24H");
  const gradient = useId();
  const series = valueSeries(profile, range);
  const start = series[0];
  const change = start > 0 ? (profile.pnl[range] / start) * 100 : 0;
  const [whole, cents] = usd(profile.value).split(".");

  const min = Math.min(...series);
  const span = Math.max(...series) - min;
  // flat series (empty account) draws a line at 70% height
  const y = (v: number) => (span === 0 ? H * 0.3 : H - 8 - ((v - min) / span) * (H - 16));
  const line = series.map((v, i) => `${i ? "L" : "M"}${(i / (series.length - 1)) * W},${y(v)}`).join("");
  const stroke = change < 0 ? "var(--down)" : "var(--up)";

  return (
    <section aria-label="Portfolio value">
      <div className="flex items-start justify-between">
        <div>
          <p data-balance className="text-[32px] leading-10 font-medium">
            {whole}
            {cents && <span className="text-text-2">.{cents}</span>}
          </p>
          <p className="flex items-center gap-1.5 text-sm text-text-2">
            {start > 0 ? <Pct value={change} /> : "--"} {range.toLowerCase()}
          </p>
        </div>
        <ChipGroup options={RANGES} value={range} onChange={setRange} />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-4 h-[200px] w-full" aria-hidden>
        <defs>
          <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={stroke} stopOpacity="0.18" />
            <stop offset="1" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line}L${W},${H}L0,${H}Z`} fill={`url(#${gradient})`} />
        <path d={line} fill="none" stroke={stroke} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
    </section>
  );
}
