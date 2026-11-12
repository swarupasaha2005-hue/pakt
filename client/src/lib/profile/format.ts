// Pure helpers for the profile page: account ids, pakt names, amounts, feed event text.
import type { EventKind, PaktEvent } from "../api";
import { token } from "../config";
import { usd } from "../format";

// NEAR account id rules: 2-64 chars, lowercase labels split by '.', '-' or '_' inside a label
const ACCOUNT_RE = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
export const isAccountId = (s: string) => s.length >= 2 && s.length <= 64 && ACCOUNT_RE.test(s);

/** route name of a pakt: first label of its vault id */
export const paktName = (vault: string) => vault.split(".")[0];

/** usd e6 (string or bigint) to dollars */
export const e6 = (v: string | bigint) => Number(v) / 1e6;

/** raw token units to a short human amount */
export function units(raw: string, decimals: number) {
  const n = Number(raw) / 10 ** decimals;
  return n.toLocaleString("en-US", { maximumSignificantDigits: 6 });
}

/** "1.5 tBTC"; unknown tokens show their account id */
export function tokenAmount(id: string, raw: string) {
  const t = token(id);
  return t ? `${units(raw, t.decimals)} ${t.symbol}` : `${raw} ${id}`;
}

export const VERB: Record<EventKind, string> = {
  pakt_created: "Created",
  deposit: "Deposited",
  leave: "Left",
  offer: "Offered",
  hired: "Hired",
  declined: "Declined",
  fired: "Fired",
  fire_pending: "Firing",
  cap_set: "Set caps",
  trade: "Traded",
  settled: "Settled",
  paused: "Paused",
  resumed: "Resumed",
  unlocked: "Unlocked",
  member_synced: "Member sync",
  claim: "Claimed",
  dex_iou: "Dex IOU",
  reconciled: "Reconciled",
  orphan_swept: "Swept",
};

/** one-line detail of an event from its data */
export function detail(e: PaktEvent): string {
  switch (e.kind) {
    case "pakt_created": return `${e.data.join_mode} pakt`;
    case "deposit": return `${usd(e6(e.data.value))} in`;
    case "leave": return e.data.payouts.map((p) => tokenAmount(p.token, p.amount)).join(" + ") || "no payout";
    case "trade": return `${tokenAmount(e.data.token_in, e.data.amount_in)} → ${tokenAmount(e.data.token_out, e.data.amount_out)} · ${usd(e6(e.data.value))}`;
    case "offer": return `${e.data.trader} · budget ${usd(e6(e.data.budget))} · fee ${e.data.fee_bps / 100}%`;
    case "hired": case "declined": case "fired": case "fire_pending": return e.data.trader;
    case "cap_set": return `budget ${usd(e6(e.data.budget))} · max ${usd(e6(e.data.max_per_trade))}`;
    case "settled": return `profit ${usd(e6(e.data.profit))}`;
    case "paused": return e.data.reason.replace(/_/g, " ");
    case "member_synced": return e.data.added ? "added to dao" : "removed from dao";
    case "claim": return tokenAmount(e.data.token, e.data.amount);
    case "reconciled": return tokenAmount(e.data.token, e.data.amount);
    case "orphan_swept": return usd(e6(e.data.value));
    default: return "";
  }
}
