// self-check: bun src/lib/pakt/votes.check.ts
import assert from "node:assert/strict";
import type { Policy, Proposal } from "../near/contracts";
import { needed, voteRows } from "./votes";

const policy = { roles: [], default_vote_policy: { weight_kind: "RoleWeight", quorum: "0", threshold: [1, 2] }, proposal_period: "86400000000000" } as unknown as Policy;
assert.equal(needed(policy, 1), 1);
assert.equal(needed(policy, 2), 2);
assert.equal(needed(policy, 3), 2);
assert.equal(needed(policy, 4), 3);

// live livetest shapes: a member sync (hidden) and a hire
const args = btoa(JSON.stringify({ account: "t.testnet", budget: "20000000", max_per_trade: "10000000", fee_bps: 1000, stop_loss_bps: 5000 }));
const ps = [
  { id: 0, description: "pakt member sync", kind: { AddMemberToRole: { member_id: "a", role: "members" } }, status: "Approved", vote_counts: { vault: [1, 0, 0] }, votes: {}, submission_time: "1794508268303473099" },
  { id: 1, description: "hire", kind: { FunctionCall: { receiver_id: "v", actions: [{ method_name: "offer_trader", args, deposit: "0", gas: "1" }] } }, status: "InProgress", vote_counts: { members: [1, 0, 0] }, votes: { "me.testnet": "Approve" }, submission_time: "1794508290732499862" },
] as unknown as Proposal[];
const open = voteRows(ps, policy, "me.testnet", 1794508290732);
assert.equal(open.length, 1);
assert.equal(open[0].title, "Hire t.testnet at 10% · budget $20.00");
assert.equal(open[0].status, "Open");
assert.equal(open[0].voted, "Approve");
assert.equal(voteRows(ps, policy, null, 1794508290732 + 86_400_001)[0].status, "Expired");
console.log("votes ok");
