import { rng } from "./rng";
import type { Token } from "./types";

export const RANGES = ["1D", "1W", "1M", "3M", "1Y"] as const;
export type ChartRange = (typeof RANGES)[number];

/** bar size in seconds + bar count per range */
const BARS: Record<ChartRange, [number, number]> = {
  "1D": [900, 96],
  "1W": [3_600, 168],
  "1M": [21_600, 120],
  "3M": [86_400, 90],
  "1Y": [604_800, 52],
};

/** fixed "now" so mock charts match between server and client */
export const NOW = Date.UTC(2026, 10, 12, 10, 15) / 1000;

export type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };

/** random walk backwards from the live price, so the last close = token.price */
export function candles(token: Token, range: ChartRange): Candle[] {
  const [step, count] = BARS[range];
  const rand = rng(token.symbol + range);
  const vol = 0.004 * Math.sqrt(step / 900);
  const out: Candle[] = [];
  let close = token.price;
  for (let i = 0; i < count; i++) {
    const open = close * (1 + (rand() - 0.5) * 2 * vol);
    const high = Math.max(open, close) * (1 + rand() * vol);
    const low = Math.min(open, close) * (1 - rand() * vol);
    const volume = (token.volume24h / 96) * (step / 900) * (0.3 + rand() * 1.4);
    out.push({ time: NOW - i * step, open, high, low, close, volume });
    close = open;
  }
  return out.reverse();
}
