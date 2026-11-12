/** percent of new profit, fixed */
export const PLATFORM_FEE = 1;

const cents = (n: number) => Math.round(n * 100) / 100;

/** split of profit above the high-water mark; flat or loss = no fees */
export function feeSplit(profit: number, traderFee: number) {
  if (profit <= 0) return { trader: 0, platform: 0, members: 0 };
  const trader = cents((profit * traderFee) / 100);
  const platform = cents((profit * PLATFORM_FEE) / 100);
  return { trader, platform, members: cents(profit - trader - platform) };
}
