import type { Pakt } from "./types";

export type VoteKind = "hire" | "raise" | "fire" | "resume";
export type VoteStatus = "Open" | "Passed" | "Rejected" | "Expired";

export type Vote = {
  id: string;
  paktId: string;
  kind: VoteKind;
  title: string;
  yes: number;
  no: number;
  endsIn: string;
  status: VoteStatus;
  /** set once you vote */
  voted?: boolean;
  /** applied to the pakt when the vote passes */
  change: Partial<Pakt>;
};

/** what a proposal modal fills in */
export type NewVote = Pick<Vote, "kind" | "title" | "change">;

export const votes: Vote[] = [
  { id: "v1", paktId: "degens", kind: "raise", title: "Raise budget → $1,000", yes: 2, no: 0, endsIn: "1d left", status: "Open", change: { budget: 1_000 } },
  { id: "v2", paktId: "degens", kind: "hire", title: "Hire alice.near at 20%", yes: 4, no: 1, endsIn: "Nov 3", status: "Passed", change: {} },
  { id: "v3", paktId: "wagmi", kind: "fire", title: "Fire bob.near", yes: 1, no: 3, endsIn: "Nov 6", status: "Rejected", change: {} },
  { id: "v4", paktId: "moonboys", kind: "hire", title: "Hire nova.near at 20%", yes: 2, no: 0, endsIn: "Nov 11", status: "Passed", change: {} },
  { id: "v5", paktId: "moonboys", kind: "fire", title: "Fire dave.near", yes: 3, no: 0, endsIn: "Nov 9", status: "Passed", change: {} },
  { id: "v6", paktId: "nightowls", kind: "raise", title: "Raise budget → $2,500", yes: 2, no: 0, endsIn: "2d left", status: "Open", change: { budget: 2_500 } },
  { id: "v7", paktId: "stackers", kind: "raise", title: "Raise budget → $8,000", yes: 1, no: 0, endsIn: "Nov 2", status: "Expired", change: {} },
];
