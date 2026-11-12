// run: bun src/lib/near/sponsor.check.ts
import assert from "node:assert/strict";
import { BASE_TOKEN, FACTORY, vaultId } from "../config";
import { createPakt, deposit, propose } from "./contracts";
import { sponsorable } from "./sponsor";

const dep = deposit(vaultId("fam"), "1"); // storage_deposit + ft_transfer_call: two txs
assert.equal(sponsorable(dep, 2), true);
assert.equal(sponsorable(dep, 1), false, "never half-sponsor a flow");
assert.equal(sponsorable(createPakt({ name: "fam", whitelist: [BASE_TOKEN.id], stopLossBps: 500, joinMode: "Open", minDeposit: "1" }, "1"), 1), true);
assert.equal(sponsorable(propose("fam.sputnikv2.testnet", vaultId("fam"), "settle", {}, "x"), 2), false, "dao calls are not ours");
assert.equal(sponsorable([{ receiverId: `x.fam.${FACTORY}`, actions: [] }], 2), false);
assert.equal(sponsorable([], 2), false);
console.log("sponsor ok");
