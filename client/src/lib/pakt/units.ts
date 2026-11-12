// Raw u128 strings <-> human numbers, and pakt share price math (target ES2017: no bigint literals).
import { token } from "../config";

/** vault share price scale: usd e6 per 1e12 shares */
export const PRICE_SCALE = BigInt(10) ** BigInt(12);

/** "1.5" → raw units; extra decimals are cut; null unless > 0 */
export function toRaw(s: string, decimals: number): string | null {
  const m = /^(\d*)(?:\.(\d*))?$/.exec(s.trim());
  if (!m || (!m[1] && !m[2])) return null;
  const raw = BigInt((m[1] || "0") + (m[2] ?? "").padEnd(decimals, "0").slice(0, decimals));
  return raw > BigInt(0) ? raw.toString() : null;
}

export const fromRaw = (raw: string | bigint, decimals: number) => Number(raw) / 10 ** decimals;

/** usd e6 → dollars */
export const e6 = (v: string | bigint) => Number(v) / 1e6;

/** "0.0000694 tBTC"; unknown tokens keep their id */
export function amount(id: string, raw: string) {
  const t = token(id);
  return t ? `${fromRaw(raw, t.decimals).toLocaleString("en-US", { maximumSignificantDigits: 6 })} ${t.symbol}` : `${raw} ${id}`;
}

/** usd e6 per 1e12 shares; null for an empty vault */
export const sharePrice = (value: bigint, totalShares: string) =>
  totalShares === "0" ? null : (value * PRICE_SCALE) / BigInt(totalShares);

/** share price as a multiple of the 1.0 launch price */
export const priceX = (p: string | bigint) => Number(p) / 1e12;

export const nearblocks = (hash: string) => `https://testnet.nearblocks.io/txns/${hash}`;

/** "2d 4h" / "3h 5m" / "4m" until a future ms timestamp */
export function left(ms: number) {
  const m = Math.max(1, Math.ceil(ms / 60_000));
  if (m < 60) return `${m}m`;
  if (m < 1_440) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${Math.floor(m / 1_440)}d ${Math.floor((m % 1_440) / 60)}h`;
}
