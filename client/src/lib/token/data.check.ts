// run: bun src/lib/token/data.check.ts
import assert from "node:assert/strict";
import { impliedPrice, stats, toCandles, type TradeEvent } from "./data";

const ev = (id: number, ts_ms: number, token_in: string, amount_in: string, token_out: string, amount_out: string, value: string) =>
  ({ id, ts_ms, kind: "trade", data: { trader: "a", token_in, amount_in, token_out, amount_out, value } }) as unknown as TradeEvent;
// 5 usdc buys 0.0000694 btc → 72046 usd/btc; sell leg uses amount_in
const buy = ev(1, 1_000, "tusdc", "5000000", "tbtc", "6940", "5000000");
const sell = ev(2, 5_000, "tbtc", "10000", "tusdc", "7000000", "7000000");
assert.equal(Math.round(impliedPrice(buy, "tbtc", 8)!), 72046);
assert.equal(impliedPrice(sell, "tbtc", 8), 70000);
assert.equal(impliedPrice(ev(3, 0, "tbtc", "0", "tusdc", "0", "0"), "tbtc", 8), null);
// coinbase rows: newest first, [t, low, high, open, close, vol]
assert.deepEqual(toCandles([[20, 1, 4, 2, 3, 9], [10, 5, 8, 6, 7, 9]]).map((c) => [c.time, c.open, c.high, c.low, c.close]), [[10, 6, 8, 5, 7], [20, 2, 4, 1, 3]]);
// inverted: high = 1/low, low = 1/high
assert.deepEqual(toCandles([[10, 0.5, 2, 1, 4, 0]], true).map((c) => [c.open, c.high, c.low, c.close]), [[1, 2, 0.5, 0.25]]);
// stats: newest first; 5M change = last close vs newest open; vol = Σ vol*close
const st = stats([[2, 0, 0, 100, 110, 2], [1, 0, 0, 50, 100, 1]])!;
assert.equal(st.last, 110);
assert.equal(st.vol24, 320);
assert.equal(Math.round(st.change["5M"]!), 10);
assert.equal(st.change["1H"], null);
console.log("token data ok");
