// DAO proposals → vote rows. Member syncs (AddMemberToRole / RemoveMemberFromRole) are hidden.
import { proposalCall, type Policy, type Proposal, type ProposalStatus } from "../near/contracts";
import { usd } from "../format";
import { e6 } from "./units";

export type VoteStatus = "Open" | "Passed" | "Rejected" | "Expired";
export type VoteRow = {
  id: number; title: string; status: VoteStatus; yes: number; no: number; endsMs: number;
  /** the viewer's vote, null if none */
  voted: string | null;
  proposal: Proposal;
};

const STATUS: Record<ProposalStatus, VoteStatus> = {
  InProgress: "Open", Approved: "Passed", Rejected: "Rejected", Removed: "Rejected", Failed: "Rejected", Expired: "Expired", Moved: "Expired",
};

function title(method: string, a: Record<string, unknown>, description: string) {
  if (method === "offer_trader") return `Hire ${a.account} at ${Number(a.fee_bps) / 100}% · budget ${usd(e6(String(a.budget)))}`;
  if (method === "set_cap") return `Set budget ${usd(e6(String(a.budget)))} · max ${usd(e6(String(a.max_per_trade)))}/trade`;
  if (method === "fire") return "Fire trader";
  if (method === "resume") return "Resume trading";
  return description || method;
}

/** sputnik RoleWeight ratio: num*total/den + 1, capped at total */
export function needed(policy: Policy, members: number) {
  const t = policy.default_vote_policy.threshold;
  const [num, den] = Array.isArray(t) ? t : [1, 2];
  return Math.max(1, Math.min(Math.floor((num * members) / den) + 1, members));
}

/** newest first; InProgress past the proposal period shows as Expired */
export function voteRows(ps: Proposal[], policy: Policy, me: string | null, now: number): VoteRow[] {
  const period = Number(policy.proposal_period) / 1e6;
  return ps
    .flatMap((p) => {
      const call = proposalCall(p);
      if (!call) return [];
      const endsMs = Number(p.submission_time) / 1e6 + period;
      const status = STATUS[p.status] === "Open" && now >= endsMs ? "Expired" : STATUS[p.status];
      const [yes = 0, no = 0] = p.vote_counts.members ?? [];
      return [{ id: p.id, title: title(call.method, call.args, p.description), status, yes, no, endsMs, voted: (me && p.votes[me]) || null, proposal: p }];
    })
    .reverse();
}
