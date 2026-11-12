// run: bun src/lib/profile/cost.check.ts
import assert from "node:assert/strict";
import type { PaktEvent } from "../api";
import { costBasis } from "./cost";

let id = 0;
const dep = (vault: string, value: number, shares: number, account = "me") =>
  ({ id: ++id, kind: "deposit", vault, data: { account, amount: "0", value: String(value * 1e6), shares: String(shares) } }) as unknown as PaktEvent;
const leave = (vault: string, shares: number, account = "me") =>
  ({ id: ++id, kind: "leave", vault, data: { account, shares: String(shares), payouts: [] } }) as unknown as PaktEvent;

const c = costBasis([dep("a", 100, 100), dep("a", 50, 25), leave("a", 50), dep("b", 10, 10, "you"), leave("c", 5)], "me");
assert.equal(c.get("a"), 150 - 150 * (50 / 125), "leave removes its share of average cost");
assert.equal(c.has("b"), false, "other accounts ignored");
assert.equal(c.get("c"), 0, "leave with no tracked deposit costs nothing");
assert.equal(costBasis([leave("a", 10), dep("a", 20, 10)].toReversed(), "me").get("a"), 20, "sorted by id: the earlier leave had nothing to remove");
console.log("cost ok");
