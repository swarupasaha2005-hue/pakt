import { describe, expect, it } from "vitest";
import { alerts, leaderboard } from "../src/stats";
import type { Row } from "../src/store";

let id = 0;
const ev = (kind: string, vault: string, ts_ms: number, data: object): Row => ({
  id: ++id, height: 1, ts_ms, tx_hash: "t", receipt_id: `r${id}`, emitter: vault, vault, kind, actor: "", data: JSON.stringify(data),
});
const trade = (trader: string, token_in: string, token_out: string, value: string, ts: number) =>
  ev("trade", "v1", ts, { trader, token_in, token_out, value });

describe("alerts", () => {
  it("groups by token and side with 2+ distinct traders", () => {
    const got = alerts([
      trade("a", "usdc", "near", "100", 10),
      trade("b", "usdc", "near", "250", 20),
      trade("a", "usdc", "near", "50", 30), // same trader again: count, not crowd
      trade("c", "near", "eth", "999", 40), // lone trader: no alert
    ]);
    expect(got).toEqual([
      { token: "near", side: "buy", traders: ["a", "b"], count: 3, total_value: "400", first_at: 10, last_at: 30 },
      { token: "usdc", side: "sell", traders: ["a", "b"], count: 3, total_value: "400", first_at: 10, last_at: 30 },
    ]);
  });
});

describe("leaderboard", () => {
  const sp = (vault: string, ts: number, share_price: string, profit: string) =>
    ev("settled", vault, ts, { share_price, hwm: share_price, profit, trader_fee_shares: "0", platform_fee_shares: "0" });

  it("credits profit to the live trader and samples share prices", () => {
    const { traders, pakts } = leaderboard([
      ev("hired", "v1", 1, { trader: "a" }),
      ev("hired", "v2", 1, { trader: "b" }),
      sp("v1", 5, "1000000000000", "700"), // before range
      trade("a", "usdc", "near", "300", 10),
      sp("v1", 20, "1100000000000", "100"),
      ev("deposit", "v2", 20, { account: "x", amount: "2000000", shares: "1000000", value: "2000000" }), // price 2e12
      sp("v1", 22, "1150000000000", "5"), // on_fire: settled, then fired, so still a's
      ev("fired", "v1", 22, { trader: "a" }),
      sp("v1", 24, "1200000000000", "7"), // no live trader: nobody's
      ev("hired", "v1", 25, { trader: "c" }),
      sp("v1", 30, "1210000000000", "10"),
      sp("v2", 30, "1900000000000", "0"),
    ], 10);
    expect(traders).toEqual([
      { trader: "a", pnl: "105", volume: "300", trades: 1 },
      { trader: "c", pnl: "10", volume: "0", trades: 0 },
      { trader: "b", pnl: "0", volume: "0", trades: 0 },
    ]);
    expect(pakts).toEqual([
      { vault: "v1", from_share_price: "1100000000000", to_share_price: "1210000000000", change: 0.1 },
      { vault: "v2", from_share_price: "2000000000000", to_share_price: "1900000000000", change: -0.05 },
    ]);
  });
});
