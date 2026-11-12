//! pakt vault: pooled funds, sputnik-governed trader, settle + fees.
use near_sdk::json_types::U128;
use near_sdk::store::{IterableMap, IterableSet, LookupMap};
use near_sdk::serde_json::json;
use near_sdk::{env, near, require, AccountId, Gas, NearToken, PanicOnDefault, PromiseOrValue};

mod dao;
mod events;
mod math;
mod oracle;
mod settle;
mod shares;
mod storage;
mod trade;
mod trader;
#[cfg(test)]
mod tests;
#[cfg(test)]
mod audit_tests;
#[cfg(test)]
mod review_tests;
#[cfg(test)]
mod lock_review_tests;

pub use trader::{Offer, Trader};

pub const MAX_MEMBERS: u32 = 100;
pub const MAX_TOKENS: usize = 8;
pub const BPS: u128 = 10_000;
pub const PLATFORM_FEE_BPS: u128 = 100;
/// share price = value_e6 * PRICE_SCALE / total_shares
pub const PRICE_SCALE: u128 = 1_000_000_000_000;
pub const DAY_MS: u64 = 86_400_000;
pub const MIN_SETTLE_PERIOD_MS: u64 = 60_000;
pub const MIN_TRADE_DELAY_MS: u64 = 60_000;
/// a lock older than this is dead (its callback failed); anyone may `unlock`
pub const LOCK_TTL_MS: u64 = 10 * 60_000;
/// after a drain hits 0 flows, new flows wait this long so the refused exclusive op can retry first
pub const DRAIN_GRACE_MS: u64 = 60_000;
/// free NEAR kept for leave + sync callbacks; deposits refuse below it
pub const STORAGE_RESERVE: NearToken = NearToken::from_millinear(500);
/// usd floor per deposit, whatever the token's decimals
pub const MIN_DEPOSIT_USD_E6: u128 = 5_000_000;
/// async ops need this much so their callback always runs and unlocks
pub const GAS_OP: Gas = Gas::from_tgas(250);
/// deposits arrive via the token's ft_transfer_call, which keeps some gas back
pub const GAS_DEPOSIT: Gas = Gas::from_tgas(150);

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum JoinMode {
    Open,
    Invite,
}

/// Trade/Accept/Fire/Recover hold `op` alone. Deposit/Leave/Settle are `flows`: atomic callbacks, may overlap each other.
#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Op {
    Deposit,
    Leave,
    Settle,
    Accept,
    Fire,
    Trade,
    Recover,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Holder {
    pub shares: U128,
    /// depositor (votes in the dao); fee-only holders are not members
    pub member: bool,
    pub joined_ms: u64,
}

#[near(serializers = [json])]
pub struct VaultConfig {
    pub dao: AccountId,
    pub oracle: AccountId,
    /// deposits only in this token; index 0 of whitelist
    pub base_token: AccountId,
    pub whitelist: Vec<AccountId>,
    pub platform: AccountId,
    pub join_mode: JoinMode,
    /// hex ed25519 pubkey; the invite link holds the secret, joiners sign their own account id
    pub invite_key: Option<String>,
    pub min_deposit: U128,
    /// sputnik proposal bond attached to member-sync proposals
    pub dao_bond: U128,
    /// ref exchange (rhea): v2.ref-finance.near / ref-finance-101.testnet
    pub dex: AccountId,
    /// min gap between public settles; 7d on mainnet, minutes for demos
    pub settle_period_ms: u64,
    /// hired trader waits this long before trading, so members can leave first
    pub trade_delay_ms: u64,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Vault {
    factory: AccountId,
    dao: AccountId,
    oracle: AccountId,
    base_token: AccountId,
    whitelist: Vec<AccountId>,
    platform: AccountId,
    join_mode: JoinMode,
    invite_key: Option<[u8; 32]>,
    min_deposit: u128,
    dao_bond: u128,
    dex: AccountId,
    settle_period_ms: u64,
    /// internal ledger, aligned with whitelist; never read from ft_balance_of
    balances: Vec<u128>,
    /// our deposits inside ref, aligned with whitelist; mid-trade or parked after a failed hop
    at_dex: Vec<u128>,
    holders: IterableMap<AccountId, Holder>,
    members: u32,
    total_shares: u128,
    /// share price at the last fee mark
    hwm: u128,
    last_settle_ms: u64,
    op: Option<Op>,
    op_since_ms: u64,
    /// bumped per lock; callbacks carry it so a stale one can't clear a newer lock
    op_id: u64,
    /// deposits/leaves/settles in flight; exclusive ops wait for 0
    flows: u32,
    /// bumped when unlock drops dead flows; flow callbacks carry it
    flow_gen: u64,
    /// when flows went 0→1, or last drained to 0 (drain grace)
    flow_since_ms: u64,
    /// an exclusive op was refused for flows: new flows wait until it runs
    draining: bool,
    /// ref shortfall at resync, aligned with whitelist; may be home already, `reconcile` credits what is provable
    suspense: Vec<u128>,
    /// leaver ious still inside ref, aligned with whitelist; not pool value
    dex_iou: Vec<u128>,
    /// leaver ious pulled home by dex_recover, waiting for `claim`
    iou_home: Vec<u128>,
    /// home tokens not ours: owed rows + payouts in flight, aligned with whitelist
    out: Vec<u128>,
    /// false once a dex hop died or resolved unknown: at_dex may be off until dex_recover resyncs
    dex_synced: bool,
    /// last block a token hit ft_on_transfer; reconcile skips if one raced its balance read
    inbound_block: u64,
    /// account → ious at ref, claimable once home
    dex_owed: LookupMap<AccountId, Vec<(AccountId, U128)>>,
    /// payouts in flight per account; storage_unregister waits for 0
    paying: LookupMap<AccountId, u32>,
    /// NEP-145 style: yocto each account prepaid for its rows + dao syncs
    storage: LookupMap<AccountId, u128>,
    trader: Option<Trader>,
    offer: Option<Offer>,
    trade_delay_ms: u64,
    /// earliest trade: accept or a cap raise + trade_delay_ms
    trade_after_ms: u64,
    /// usd e6 lost to swaps vs oracle since last settle
    slip_used: u128,
    /// start of the 24h slippage window
    slip_since_ms: u64,
    /// fire hit a busy lock; trader paused until `finish_fire`
    fire_pending: bool,
    owed: LookupMap<AccountId, Vec<(AccountId, U128)>>,
    pending_sync: IterableSet<AccountId>,
    events: LookupMap<u32, String>,
    event_count: u64,
}

#[near(serializers = [json])]
pub struct StateView {
    pub factory: AccountId,
    pub dao: AccountId,
    pub oracle: AccountId,
    pub dex: AccountId,
    pub platform: AccountId,
    pub join_mode: JoinMode,
    pub min_deposit: U128,
    pub balances: Vec<(AccountId, U128)>,
    pub at_dex: Vec<(AccountId, U128)>,
    pub total_shares: U128,
    pub members: u32,
    pub hwm: U128,
    pub last_settle_ms: u64,
    pub settle_period_ms: u64,
    pub op: Option<Op>,
    pub trader: Option<Trader>,
    pub offer: Option<Offer>,
    pub op_since_ms: u64,
    pub trade_delay_ms: u64,
    pub trade_after_ms: u64,
    pub slip_used: U128,
    pub fire_pending: bool,
    pub flows: u32,
    pub slip_since_ms: u64,
    pub draining: bool,
    pub suspense: Vec<(AccountId, U128)>,
    pub dex_iou: Vec<(AccountId, U128)>,
    pub iou_home: Vec<(AccountId, U128)>,
    pub dex_synced: bool,
}

#[near]
impl Vault {
    /// Factory deploys + inits in one batch, so nobody can init first.
    #[init]
    pub fn new(config: VaultConfig) -> Self {
        let c = config;
        require!(c.whitelist.first() == Some(&c.base_token), "base_token must be whitelist[0]");
        require!(c.whitelist.len() <= MAX_TOKENS, "too many tokens");
        let mut seen = c.whitelist.clone();
        seen.sort();
        seen.dedup();
        require!(seen.len() == c.whitelist.len(), "duplicate token");
        let invite_key = c.invite_key.map(|k| hex_decode(&k).try_into().unwrap_or_else(|_| env::panic_str("invite key must be 32 bytes")));
        require!(c.join_mode == JoinMode::Open || invite_key.is_some(), "invite mode needs invite_key");
        require!(c.settle_period_ms >= MIN_SETTLE_PERIOD_MS, "settle_period_ms >= 60000");
        require!(c.trade_delay_ms >= MIN_TRADE_DELAY_MS, "trade_delay_ms >= 60000");
        trade::register_dex(&c.dex, &c.whitelist);
        Self {
            factory: env::predecessor_account_id(),
            balances: vec![0; c.whitelist.len()],
            at_dex: vec![0; c.whitelist.len()],
            suspense: vec![0; c.whitelist.len()],
            dex_iou: vec![0; c.whitelist.len()],
            iou_home: vec![0; c.whitelist.len()],
            out: vec![0; c.whitelist.len()],
            dao: c.dao,
            oracle: c.oracle,
            base_token: c.base_token,
            whitelist: c.whitelist,
            platform: c.platform,
            join_mode: c.join_mode,
            invite_key,
            min_deposit: c.min_deposit.0,
            dao_bond: c.dao_bond.0,
            dex: c.dex,
            settle_period_ms: c.settle_period_ms,
            holders: IterableMap::new(b"h"),
            members: 0,
            total_shares: 0,
            hwm: 0,
            last_settle_ms: env::block_timestamp_ms(),
            op: None,
            op_since_ms: 0,
            op_id: 0,
            flows: 0,
            flow_gen: 0,
            flow_since_ms: 0,
            draining: false,
            dex_synced: true,
            inbound_block: 0,
            dex_owed: LookupMap::new(b"d"),
            paying: LookupMap::new(b"p"),
            storage: LookupMap::new(b"t"),
            trader: None,
            offer: None,
            trade_delay_ms: c.trade_delay_ms,
            trade_after_ms: 0,
            slip_used: 0,
            slip_since_ms: env::block_timestamp_ms(),
            fire_pending: false,
            owed: LookupMap::new(b"o"),
            pending_sync: IterableSet::new(b"s"),
            events: LookupMap::new(b"e"),
            event_count: 0,
        }
    }

    /// NEP-141 receiver: base token deposits only, everything else refunded.
    pub fn ft_on_transfer(&mut self, sender_id: AccountId, amount: U128, msg: String) -> PromiseOrValue<U128> {
        self.inbound_block = env::block_height();
        if env::predecessor_account_id() != self.base_token {
            env::log_str("refund: not base token");
            return PromiseOrValue::Value(amount);
        }
        self.deposit(sender_id, amount, msg)
    }

    pub fn get_state(&self) -> StateView {
        StateView {
            factory: self.factory.clone(),
            dao: self.dao.clone(),
            oracle: self.oracle.clone(),
            dex: self.dex.clone(),
            platform: self.platform.clone(),
            join_mode: self.join_mode,
            min_deposit: U128(self.min_deposit),
            balances: self.whitelist.iter().cloned().zip(self.balances.iter().map(|b| U128(*b))).collect(),
            at_dex: self.whitelist.iter().cloned().zip(self.at_dex.iter().map(|b| U128(*b))).collect(),
            total_shares: U128(self.total_shares),
            members: self.members,
            hwm: U128(self.hwm),
            last_settle_ms: self.last_settle_ms,
            settle_period_ms: self.settle_period_ms,
            op: self.op,
            trader: self.trader.clone(),
            offer: self.offer.clone(),
            op_since_ms: self.op_since_ms,
            trade_delay_ms: self.trade_delay_ms,
            trade_after_ms: self.trade_after_ms,
            slip_used: U128(self.slip_used),
            fire_pending: self.fire_pending,
            flows: self.flows,
            slip_since_ms: self.slip_since_ms,
            draining: self.is_draining(),
            suspense: self.per_token(&self.suspense),
            dex_iou: self.per_token(&self.dex_iou),
            iou_home: self.per_token(&self.iou_home),
            dex_synced: self.dex_synced,
        }
    }

    pub fn get_holders(&self, from: Option<u32>, limit: Option<u32>) -> Vec<(AccountId, Holder)> {
        let from = from.unwrap_or(0) as usize;
        let limit = limit.unwrap_or(MAX_MEMBERS) as usize;
        self.holders.iter().skip(from).take(limit).map(|(a, h)| (a.clone(), h.clone())).collect()
    }

    pub fn get_holder(&self, account: AccountId) -> Option<&Holder> {
        self.holders.get(&account)
    }

    pub fn get_owed(&self, account: AccountId) -> Vec<(AccountId, U128)> {
        self.owed.get(&account).cloned().unwrap_or_default()
    }

    /// ious left at ref by a leave; `claim` once dex_recover brought them home
    pub fn get_dex_owed(&self, account: AccountId) -> Vec<(AccountId, U128)> {
        self.dex_owed.get(&account).cloned().unwrap_or_default()
    }

    pub fn get_pending_sync(&self) -> Vec<AccountId> {
        self.pending_sync.iter().cloned().collect()
    }

    /// Clears a lock or flows whose callback died (e.g. out of NEAR). Anyone, after LOCK_TTL_MS.
    pub fn unlock(&mut self) {
        let now = env::block_timestamp_ms();
        let op = self.op.filter(|_| now >= self.op_since_ms + LOCK_TTL_MS);
        let flows = if now >= self.flow_since_ms + LOCK_TTL_MS { self.flows } else { 0 };
        require!(op.is_some() || flows > 0, "nothing stale to unlock");
        if op.is_some() {
            self.op = None;
            // a dead hop may have moved funds at ref without booking them
            self.dex_synced = false;
        }
        if flows > 0 {
            self.flows = 0;
            self.flow_gen += 1;
            self.flow_since_ms = now;
        }
        self.emit("unlocked", json!({"op": op, "flows": flows}));
    }
}

impl Vault {
    /// false: flows in flight, so it sets `draining` (no panic, the flag must stick) and the caller retries
    #[must_use]
    fn lock(&mut self, op: Op, gas: Gas) -> bool {
        require!(self.op.is_none(), "busy, retry");
        require!(env::prepaid_gas() >= gas, format!("attach at least {gas}"));
        if self.flows > 0 {
            self.draining = true;
            env::log_str("busy: draining flows, retry");
            return false;
        }
        self.draining = false;
        self.op = Some(op);
        self.op_since_ms = env::block_timestamp_ms();
        self.op_id += 1;
        true
    }

    /// flows in flight, or drained less than DRAIN_GRACE_MS ago, with an exclusive op waiting
    fn is_draining(&self) -> bool {
        self.draining && (self.flows > 0 || env::block_timestamp_ms() < self.flow_since_ms + DRAIN_GRACE_MS)
    }

    /// Deposit/leave/settle start: exclusive ops and drains block it. Returns the gen its callback must carry.
    fn start_flow(&mut self, gas: Gas) -> u64 {
        require!(self.op.is_none(), "busy, retry");
        require!(!self.is_draining(), "draining, retry");
        require!(env::prepaid_gas() >= gas, format!("attach at least {gas}"));
        // grace over: the waiting op had its chance
        self.draining = false;
        if self.flows == 0 {
            self.flow_since_ms = env::block_timestamp_ms();
        }
        self.flows += 1;
        self.flow_gen
    }

    /// flow callback: false (state untouched) if unlock dropped it
    fn end_flow(&mut self, gen: u64) -> bool {
        if gen != self.flow_gen {
            env::log_str("stale callback: flow dropped by unlock, ignored");
            return false;
        }
        self.flows = self.flows.saturating_sub(1);
        if self.flows == 0 {
            self.flow_since_ms = env::block_timestamp_ms();
        }
        true
    }

    /// callback whose lock was unlocked or replaced: must not touch state
    fn stale(&self, id: u64) -> bool {
        let stale = self.op.is_none() || self.op_id != id;
        if stale {
            env::log_str("stale callback: lock not ours, ignored");
        }
        stale
    }

    /// NEAR left after paying for current storage
    fn free_near(&self) -> NearToken {
        env::account_balance().saturating_sub(env::storage_byte_cost().saturating_mul(env::storage_usage() as u128))
    }

    fn per_token(&self, v: &[u128]) -> Vec<(AccountId, U128)> {
        self.whitelist.iter().cloned().zip(v.iter().map(|b| U128(*b))).collect()
    }

    fn token_index(&self, token: &AccountId) -> usize {
        self.whitelist.iter().position(|t| t == token).unwrap_or_else(|| env::panic_str("token not whitelisted"))
    }

    fn only_dao(&self) {
        require!(env::predecessor_account_id() == self.dao, "only dao");
    }
}

/// Result of promise 0, capped so a huge reply can't burn the callback's gas.
pub(crate) fn promise_ok(max_len: usize) -> Option<Vec<u8>> {
    env::promise_result_checked(0, max_len).ok()
}

fn hex_decode(s: &str) -> Vec<u8> {
    hex_decode_opt(s).unwrap_or_else(|| env::panic_str("bad hex"))
}

pub(crate) fn hex_decode_opt(s: &str) -> Option<Vec<u8>> {
    if s.len() % 2 != 0 {
        return None;
    }
    (0..s.len()).step_by(2).map(|i| u8::from_str_radix(s.get(i..i + 2)?, 16).ok()).collect()
}
