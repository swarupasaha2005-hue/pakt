import type { Token } from "./types";

export const TIMEFRAMES = ["5m", "1h", "4h", "24h"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

const SHARE: Record<Timeframe, number> = { "5m": 1 / 288, "1h": 1 / 24, "4h": 1 / 6, "24h": 1 };

/** mock: only 24h stats exist, shorter windows are scaled from them */
export const changeIn = (t: Token, tf: Timeframe) => t.change24h * Math.sqrt(SHARE[tf]);
export const volumeIn = (t: Token, tf: Timeframe) => t.volume24h * SHARE[tf];
