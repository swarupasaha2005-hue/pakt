import { describe, expect, it } from "vitest";
import { alerts, cloneConfig, leaderboard, traderRecord } from "../src/stats";
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

describe("copy pakt", () => {
  const offer = (vault: string, trader: string, ts: number, fee_bps: number) =>
    ev("offer", vault, ts, { trader, budget: "500", max_per_trade: "50", fee_bps, stop_loss_bps: 2500 });
  const rows = [
    ev("pakt_created", "v1", 1, { name: "moon", vault: "v1", dao: "moon.dao", creator: "al", join_mode: "Open" }),
    offer("v1", "bob", 2, 2000), ev("hired", "v1", 3, { trader: "bob" }),
    ev("trade", "v1", 4, { trader: "bob", value: "40" }),
    ev("settled", "v1", 5, { profit: "120" }),
    ev("cap_set", "v1", 6, { budget: "900", max_per_trade: "90" }),
    ev("settled", "v2", 6, { profit: "999" }), // bob not live on v2
    ev("fired", "v1", 7, { trader: "bob" }),
    ev("settled", "v1", 8, { profit: "50" }), // after fire: not bob's
    offer("v2", "bob", 9, 1500), ev("hired", "v2", 10, { trader: "bob" }),
    ev("settled", "v2", 11, { profit: "30" }),
  ];

  it("records each tenure with its terms and profit while live", () => {
    const r = traderRecord(rows, "bob");
    expect(r).toMatchObject({ trader: "bob", pnl: "150", volume: "40", trades: 1, live: 1 });
    expect(r.pakts).toEqual([
      { vault: "v2", hired_at: 10, fired_at: null, terms: { budget: "500", max_per_trade: "50", fee_bps: 1500, stop_loss_bps: 2500 }, pnl: "30", volume: "0", trades: 0 },
      { vault: "v1", hired_at: 3, fired_at: 7, terms: { budget: "900", max_per_trade: "90", fee_bps: 2000, stop_loss_bps: 2500 }, pnl: "120", volume: "40", trades: 1 },
    ]);
    expect(traderRecord(rows, "nobody")).toMatchObject({ pnl: "0", trades: 0, live: 0, pakts: [] });
  });

  it("clones a pakt's setup and current trader terms", () => {
    expect(cloneConfig(rows, "v1")).toEqual({ vault: "v1", name: "moon", dao: "moon.dao", creator: "al", join_mode: "Open", trader: null, terms: { budget: "900", max_per_trade: "90", fee_bps: 2000, stop_loss_bps: 2500 } });
    expect(cloneConfig(rows, "v2")).toBeNull(); // no pakt_created seen
  });
});
