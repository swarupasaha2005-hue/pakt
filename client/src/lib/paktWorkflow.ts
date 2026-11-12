import type { Pakt } from "./mock/types";
import type { NewVote } from "./mock/votes";

export function approvedVoteChange(pakt: Pakt, vote: NewVote): Partial<Pakt> {
  if (vote.kind === "hire") {
    if (!vote.change.trader) return {};
    return { pendingOffer: {
      to: vote.change.trader,
      budget: vote.change.budget ?? 0,
      maxPerTrade: vote.change.maxPerTrade ?? 0,
      stopLoss: vote.change.stopLoss ?? pakt.stopLoss,
      fee: vote.change.fee ?? 0,
    } };
  }
  return { ...vote.change, paused: vote.kind === "resume" || vote.kind === "fire" ? false : pakt.paused };
}
