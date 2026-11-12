import assert from "node:assert/strict";
import { pakts } from "./mock/pakts";
import { approvedVoteChange } from "./paktWorkflow";

const pakt = { ...pakts[0], trader: null, paused: true };
const hired = approvedVoteChange(pakt, {
  kind: "hire", title: "Hire candidate",
  change: { trader: "nova.near", budget: 500, maxPerTrade: 50, fee: 20 },
});
assert.equal(hired.trader, undefined);
assert.equal(hired.pendingOffer?.to, "nova.near");
assert.equal(hired.pendingOffer?.stopLoss, pakt.stopLoss);
assert.equal(({ ...pakt, ...hired }).trader, null);
assert.deepEqual(approvedVoteChange(pakt, { kind: "hire", title: "Invalid hire", change: {} }), {});
assert.equal(approvedVoteChange(pakt, { kind: "resume", title: "Resume", change: {} }).paused, false);
assert.equal(approvedVoteChange(pakt, { kind: "raise", title: "Raise", change: { budget: 800 } }).paused, true);
console.log("pakt workflow ok");
