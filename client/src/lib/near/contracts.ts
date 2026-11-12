// Chain views over RPC and transaction builders for every pakt action. Args, deposits and gas mirror contracts/e2e.
import { actionCreators, type Action } from "@near-js/transactions";
import { BASE_TOKEN, FACTORY, ORACLE, RPC_URL } from "../config";
import type { JoinMode } from "../api";

export type Tx = { receiverId: string; actions: Action[] };

const TGAS = 1_000_000_000_000;
const ONE_YOCTO = "1";
/** vault storage_deposit for joiners; excess refunded */
export const STORAGE_FEE = "10000000000000000000000";
/** factory config dao_bond: sputnik proposal_bond, 0.1 NEAR on testnet */
export const DAO_BOND = "100000000000000000000000";
/** vault async ops demand 250 TGas prepaid */
const PROPOSAL_GAS = String(250 * TGAS);

// ---- views

async function view<T>(contract: string, method: string, args: object = {}): Promise<T> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: "pakt", method: "query",
      params: { request_type: "call_function", finality: "final", account_id: contract, method_name: method, args_base64: btoa(JSON.stringify(args)) },
    }),
  });
  const r = await res.json();
  // rpc errors come as r.error, contract panics as r.result.error
  const err = r.error?.data ?? r.error?.message ?? r.result?.error;
  if (err) throw new Error(`${contract}.${method}: ${typeof err === "string" ? err : JSON.stringify(err)}`);
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(r.result.result as number[])));
}

export type Op = "Deposit" | "Leave" | "Settle" | "Accept" | "Fire" | "Trade" | "Recover";
/** caps are usd e6 */
export type Trader = { account: string; fee_bps: number; budget: string; max_per_trade: string; budget_used: string; stop_loss_bps: number; paused: boolean };
export type Offer = { terms: Trader; expires_ms: number };
/** [token, amount] in whitelist order; index 0 is the base token */
export type TokenAmounts = [string, string][];
export type VaultState = {
  factory: string; dao: string; oracle: string; dex: string; platform: string; join_mode: JoinMode; min_deposit: string;
  balances: TokenAmounts; at_dex: TokenAmounts; total_shares: string; members: number;
  /** share price at the last fee mark, usd e6 per 1e12 shares */
  hwm: string; last_settle_ms: number; settle_period_ms: number;
  op: Op | null; trader: Trader | null; offer: Offer | null; op_since_ms: number;
  trade_delay_ms: number; trade_after_ms: number; slip_used: string; fire_pending: boolean; flows: number; slip_since_ms: number;
  draining: boolean; suspense: TokenAmounts; dex_iou: TokenAmounts; iou_home: TokenAmounts; dex_synced: boolean;
};
export type Holder = { shares: string; member: boolean; joined_ms: number };
export type StorageBalance = { total: string; available: string };

export const getState = (vault: string) => view<VaultState>(vault, "get_state");
export const getHolders = (vault: string, from?: number, limit?: number) => view<[string, Holder][]>(vault, "get_holders", { from, limit });
export const getHolder = (vault: string, account: string) => view<Holder | null>(vault, "get_holder", { account });
/** payouts that failed (e.g. not registered on the token); `claim` them */
export const getOwed = (vault: string, account: string) => view<[string, string][]>(vault, "get_owed", { account });
/** accounts whose dao membership sync failed; `syncMember` retries */
export const getPendingSync = (vault: string) => view<string[]>(vault, "get_pending_sync");
export const getDexOwed = (vault: string, account: string) => view<[string, string][]>(vault, "get_dex_owed", { account });
/** vault or any NEP-145 token */
export const storageBalanceOf = (contract: string, account: string) => view<StorageBalance | null>(contract, "storage_balance_of", { account_id: account });
export const ftBalanceOf = (token: string, account: string) => view<string>(token, "ft_balance_of", { account_id: account });

export type FactoryPakt = { name: string; vault: string; dao: string; creator: string; created_ms: number; stop_loss_bps: number };
export const getPakt = (name: string) => view<FactoryPakt | null>(FACTORY, "get_pakt", { name });
export const listPakts = (from?: number, limit?: number) => view<FactoryPakt[]>(FACTORY, "list_pakts", { from, limit });
/** yocto NEAR to attach to create_pakt */
export const requiredDeposit = (whitelistLen: number) => view<string>(FACTORY, "required_deposit", { whitelist_len: whitelistLen });

/** usd = raw * multiplier / 10^decimals; price null when stale */
export type Price = { multiplier: string; decimals: number };
export type PriceData = { timestamp: string; recency_duration_sec: number; prices: { asset_id: string; price: Price | null }[] };
export const getPrices = (tokens: string[]) => view<PriceData>(ORACLE, "get_price_data", { asset_ids: tokens });

export type ProposalStatus = "InProgress" | "Approved" | "Rejected" | "Removed" | "Expired" | "Moved" | "Failed";
export type FunctionCallKind = { FunctionCall: { receiver_id: string; actions: { method_name: string; args: string; deposit: string; gas: string }[] } };
export type Proposal = {
  id: number; proposer: string; description: string;
  /** FunctionCall for member proposals; AddMemberToRole / RemoveMemberFromRole for vault member syncs */
  kind: FunctionCallKind | Record<string, unknown>;
  status: ProposalStatus;
  /** role -> [approve, reject, remove] */
  vote_counts: Record<string, [number, number, number]>;
  votes: Record<string, "Approve" | "Reject" | "Remove">;
  /** ns */
  submission_time: string;
};
export type Role = { name: string; kind: { Group: string[] } | string; permissions: string[]; vote_policy: object };
export type Policy = {
  roles: Role[]; default_vote_policy: { weight_kind: string; quorum: string; threshold: [number, number] | string };
  proposal_bond: string; proposal_period: string; bounty_bond: string; bounty_forgiveness_period: string;
};
export const getProposals = (dao: string, from = 0, limit = 50) => view<Proposal[]>(dao, "get_proposals", { from_index: from, limit });
export const getProposal = (dao: string, id: number) => view<Proposal>(dao, "get_proposal", { id });
export const getLastProposalId = (dao: string) => view<number>(dao, "get_last_proposal_id");
export const getPolicy = (dao: string) => view<Policy>(dao, "get_policy");

// ---- math, all usd e6

/** accounts in the dao members role */
export const daoMembers = (p: Policy) => {
  const kind = p.roles.find((r) => r.name === "members")?.kind;
  return typeof kind === "object" ? kind.Group : [];
};

/** vault method + json args of a member FunctionCall proposal, else null */
export function proposalCall(p: Proposal): { method: string; args: Record<string, unknown> } | null {
  const a = (p.kind as Partial<FunctionCallKind>).FunctionCall?.actions[0];
  return a ? { method: a.method_name, args: JSON.parse(atob(a.args) || "{}") } : null;
}

export function usdE6(prices: PriceData, token: string, raw: string): bigint | null {
  const p = prices.prices.find((x) => x.asset_id === token)?.price;
  if (!p) return null;
  return (BigInt(raw) * BigInt(p.multiplier) * BigInt(1_000_000)) / BigInt(10) ** BigInt(p.decimals);
}

/** balances + at_dex at oracle prices, as the vault's vault_value; null if any held token has no price */
export function vaultValue(s: VaultState, prices: PriceData): bigint | null {
  let total = BigInt(0);
  for (const [i, [token, bal]] of s.balances.entries()) {
    const held = BigInt(bal) + BigInt(s.at_dex[i]?.[1] ?? "0");
    if (held === BigInt(0)) continue;
    const v = usdE6(prices, token, held.toString());
    if (v === null) return null;
    total += v;
  }
  return total;
}

/** usd e6 worth of `shares` given vault value */
export const sharesValue = (shares: string, s: VaultState, value: bigint) =>
  s.total_shares === "0" ? BigInt(0) : (BigInt(shares) * value) / BigInt(s.total_shares);

// ---- transactions

const call = (method: string, args: object, tgas: number, deposit = "0") =>
  actionCreators.functionCall(method, args, BigInt(tgas * TGAS), BigInt(deposit));

export type CreatePakt = {
  /** 2-32 chars of a-z 0-9 - _ */
  name: string;
  /** 1-8 tokens, [0] must be the base token */
  whitelist: string[];
  /** 100-9000 */
  stopLossBps: number;
  joinMode: JoinMode;
  /** 64-hex ed25519 pubkey, required for Invite */
  inviteKey?: string | null;
  /** base token raw units */
  minDeposit: string;
};
/** deposit: requiredDeposit(whitelist.length); excess is refunded */
export const createPakt = (p: CreatePakt, deposit: string): Tx[] => [{
  receiverId: FACTORY,
  actions: [call("create_pakt", {
    name: p.name, whitelist: p.whitelist, stop_loss_bps: p.stopLossBps, join_mode: p.joinMode,
    invite_key: p.inviteKey ?? null, min_deposit: p.minDeposit,
  }, 300, deposit)],
}];

/** storage_deposit (tops up, refunds excess) then base token ft_transfer_call. msg carries the invite sig: {"invite_sig": hex} */
export const deposit = (vault: string, amount: string, msg = "", token = BASE_TOKEN.id): Tx[] => [
  { receiverId: vault, actions: [call("storage_deposit", {}, 30, STORAGE_FEE)] },
  { receiverId: token, actions: [call("ft_transfer_call", { receiver_id: vault, amount, msg }, 300, ONE_YOCTO)] },
];

/** burn shares for a pro-rata slice of every token, in kind */
export const leave = (vault: string, shares: string): Tx[] => [{ receiverId: vault, actions: [call("leave", { shares }, 300)] }];
/** retry a parked payout (get_owed) */
export const claim = (vault: string, token: string): Tx[] => [{ receiverId: vault, actions: [call("claim", { token }, 300)] }];

// ---- recovery, callable by anyone
/** pays out a fire the dao vote couldn't finish (busy vault or low gas) */
export const finishFire = (vault: string): Tx[] => [{ receiverId: vault, actions: [call("finish_fire", {}, 300)] }];
/** pulls funds parked at ref back into the vault */
export const dexRecover = (vault: string, token: string): Tx[] => [{ receiverId: vault, actions: [call("dex_recover", { token }, 300)] }];
/** credits tokens the vault holds beyond its ledger back to the pool */
export const reconcile = (vault: string, token: string): Tx[] => [{ receiverId: vault, actions: [call("reconcile", { token }, 100)] }];
/** clears a lock whose callback died, after the 10 min ttl */
export const unlock = (vault: string): Tx[] => [{ receiverId: vault, actions: [call("unlock", {}, 30)] }];
/** retries a failed dao sync; needs dao bond + 0.003 NEAR, the excess is refunded */
export const syncMember = (vault: string, account: string): Tx[] => [
  { receiverId: vault, actions: [call("sync_member", { account }, 300, SYNC_DEPOSIT)] },
];
const SYNC_DEPOSIT = "250000000000000000000000"; // 0.25 NEAR covers any bond a pakt sets today; refunded above need
export const LOCK_TTL_MS = 10 * 60_000;

/** member proposal: dao runs `vault.method(args)` once approved */
export const propose = (dao: string, vault: string, method: string, args: object, description: string, bond = DAO_BOND): Tx[] => [{
  receiverId: dao,
  actions: [call("add_proposal", {
    proposal: {
      description,
      kind: { FunctionCall: { receiver_id: vault, actions: [{ method_name: method, args: btoa(JSON.stringify(args)), deposit: "0", gas: PROPOSAL_GAS }] } },
    },
  }, 300, bond)],
}];

export type TraderTerms = {
  account: string;
  /** usd e6 */
  budget: string;
  maxPerTrade: string;
  /** 1000-3000 */
  feeBps: number;
  /** 100-9000 */
  stopLossBps: number;
};
export const proposeTrader = (dao: string, vault: string, t: TraderTerms, description = `hire ${t.account}`) =>
  propose(dao, vault, "offer_trader", {
    account: t.account, budget: t.budget, max_per_trade: t.maxPerTrade, fee_bps: t.feeBps, stop_loss_bps: t.stopLossBps,
  }, description);
export const proposeFire = (dao: string, vault: string, description = "fire trader") => propose(dao, vault, "fire", {}, description);
/** new caps reset budget_used; more room restarts the trade delay */
export const proposeCap = (dao: string, vault: string, budget: string, maxPerTrade: string, description = "set caps") =>
  propose(dao, vault, "set_cap", { budget, max_per_trade: maxPerTrade }, description);
/** unpause after a stop-loss */
export const proposeResume = (dao: string, vault: string, description = "resume trader") => propose(dao, vault, "resume", {}, description);

/** sputnik wants the proposal kind echoed back; the vote that passes runs the vault call, hence 300 TGas */
export const vote = (dao: string, p: Proposal, action: "VoteApprove" | "VoteReject" = "VoteApprove"): Tx[] => [
  { receiverId: dao, actions: [call("act_proposal", { id: p.id, action, proposal: p.kind }, 300)] },
];

export const acceptOffer = (vault: string): Tx[] => [{ receiverId: vault, actions: [call("accept_offer", {}, 300)] }];
export const declineOffer = (vault: string): Tx[] => [{ receiverId: vault, actions: [call("decline_offer", {}, 30)] }];

export type Trade = {
  /** ref pool holding both tokens, see config TOKENS[].pool */
  poolId: number;
  tokenIn: string;
  tokenOut: string;
  /** raw units of tokenIn */
  amountIn: string;
  /** raw units; the vault raises it to oracle price minus 2% */
  minOut: string;
};
/** trader only, within caps, after trade_after_ms */
export const trade = (vault: string, t: Trade): Tx[] => [{
  receiverId: vault,
  actions: [call("trade", { pool_id: t.poolId, token_in: t.tokenIn, token_out: t.tokenOut, amount_in: t.amountIn, min_out: t.minOut }, 300)],
}];

/** anyone, once last_settle_ms + settle_period_ms has passed */
export const settle = (vault: string): Tx[] => [{ receiverId: vault, actions: [call("settle", {}, 300)] }];
