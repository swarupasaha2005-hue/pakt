const compactUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

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

/** $12.4M */
export const compact = (n: number) => compactUsd.format(n);
