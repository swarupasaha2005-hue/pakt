import type { Range } from "./types";

const SPAN: Record<Range, number> = { "24H": 0.15, "7D": 1, "30D": 2.2, ALL: 3 };

/** fake vault value series ending at `value`, start scaled off the 7d pnl */
export function history(value: number, pnl7d: number, range: Range, points = 48) {
  const start = value - pnl7d * SPAN[range];
  return Array.from({ length: points }, (_, i) => {
    const t = i / (points - 1);
    const wiggle = i === points - 1 ? 0 : Math.sin(i * 1.7) * Math.abs(pnl7d) * 0.08;
    return start + (value - start) * t + wiggle;
  });
}
