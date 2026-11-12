const compactUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

const compactNum = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** $73,442 / $5.42 / $0.0912 / $0.0000000171 */
export function usd(n: number) {
  if (n > 0 && n < 1) return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumSignificantDigits: 4 });
  const digits = n >= 1000 ? 0 : 2;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** $10,783 */
export const wholeUsd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** $12.4M */
export const compact = (n: number) => compactUsd.format(n);

/** 8.4K */
export const count = (n: number) => compactNum.format(n);

/** +$1,240 / -$310; pass compact for +$1.24K */
export const signed = (n: number, fmt = usd) => `${n < 0 ? "-" : "+"}${fmt(Math.abs(n))}`;

/** 25s / 4m / 2h / 3d */
export function ago(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h`;
  return `${Math.floor(seconds / 86_400)}d`;
}
