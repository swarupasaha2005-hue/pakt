//! Trader lifecycle. Dao proposals offer / cap / fire / resume; the offered account must sign accept.
use near_sdk::json_types::U128;
use near_sdk::serde_json::json;
use near_sdk::{env, near, require, AccountId, Gas, GasWeight, NearToken, Promise};

use crate::oracle;
use crate::{Op, Vault, VaultExt, DAY_MS, FIRE_WAIT_MS, GAS_OP, STORAGE_RESERVE};

pub const FEE_MIN_BPS: u16 = 1_000;
pub const FEE_MAX_BPS: u16 = 3_000;
const OFFER_TTL_MS: u64 = 3 * DAY_MS;
const GAS_CB: Gas = Gas::from_tgas(30);
/// factory reputation row for a first-time trader (~300 bytes); excess refunded
const RECORD_DEPOSIT: NearToken = NearToken::from_millinear(10);

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Trader {
    pub account: AccountId,
    pub fee_bps: u16,
    /// usd e6
    pub budget: U128,
    pub max_per_trade: U128,
    pub budget_used: U128,
    pub stop_loss_bps: u16,
    pub paused: bool,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Offer {
    pub terms: Trader,
    pub expires_ms: u64,
}

#[near]
impl Vault {
    /// Replaces any pending offer. Fire the live trader first.
    pub fn offer_trader(&mut self, account: AccountId, budget: U128, max_per_trade: U128, fee_bps: u16, stop_loss_bps: u16) {
        self.only_dao();
        require!(self.trader.is_none(), "fire current trader first");
        require!((FEE_MIN_BPS..=FEE_MAX_BPS).contains(&fee_bps), "fee must be 10-30%");
        require!((100..=9_000).contains(&stop_loss_bps), "stop-loss must be 1-90%");
        require!(max_per_trade.0 > 0 && max_per_trade.0 <= budget.0, "bad caps");
        let expires_ms = env::block_timestamp_ms() + OFFER_TTL_MS;
        let terms = Trader { account, fee_bps, budget, max_per_trade, budget_used: U128(0), stop_loss_bps, paused: false };
        self.emit(
            "offer",
            json!({"trader": terms.account, "budget": budget, "max_per_trade": max_per_trade, "fee_bps": fee_bps,
                   "stop_loss_bps": stop_loss_bps, "expires_at_ms": expires_ms.to_string()}),
        );
        self.offer = Some(Offer { terms, expires_ms });
    }

    /// Marks gains first without fee, so the trader is only paid on profit after hire.
    pub fn accept_offer(&mut self) {
        let me = env::predecessor_account_id();
        let o = self.offer.as_ref().unwrap_or_else(|| env::panic_str("no offer"));
        require!(o.terms.account == me, "offer is not for you");
        require!(env::block_timestamp_ms() < o.expires_ms, "offer expired");
        if !self.lock(Op::Accept, GAS_OP) {
            return;
        }
        oracle::fetch(&self.oracle, self.whitelist.clone())
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_CB).on_accept(me, self.op_id))
            .detach();
    }

    #[private]
    pub fn on_accept(&mut self, account: AccountId, id: u64) {
        if self.stale(id) {
            return;
        }
        self.op = None;
        // dao may have swapped the offer while prices were in flight
        let live = self.offer.as_ref().is_some_and(|o| o.terms.account == account && env::block_timestamp_ms() < o.expires_ms);
        if !live {
            return env::log_str("accept failed: offer changed or expired");
        }
        let Some(value) = oracle::read().and_then(|p| self.vault_value(&p)) else {
            return env::log_str("accept failed: no prices, retry");
        };
        let Some(o) = self.offer.take() else { return };
        self.crystallize(value, false);
        self.emit("hired", json!({"trader": o.terms.account}));
        self.trader = Some(o.terms);
        self.trader_mark = self.share_price(value);
        self.record(&account, "Hire", 0, 0);
        self.trade_after_ms = env::block_timestamp_ms() + self.trade_delay_ms;
    }

    pub fn decline_offer(&mut self) {
        let me = env::predecessor_account_id();
        require!(self.offer.as_ref().is_some_and(|o| o.terms.account == me), "offer is not for you");
        self.offer = None;
        self.emit("declined", json!({"trader": me}));
    }

    /// Pays the trader for profit so far, then removes them. Oracle down: waits up to an hour for prices, then fires anyway.
    /// Always pauses first; busy lock or under GAS_OP prepaid: anyone runs `finish_fire`, so the dao proposal never fails.
    pub fn fire(&mut self) {
        self.only_dao();
        let t = self.trader.as_mut().unwrap_or_else(|| env::panic_str("no trader"));
        t.paused = true;
        if !self.fire_pending {
            self.fire_since_ms = env::block_timestamp_ms();
        }
        self.fire_pending = true;
        let trader = t.account.clone();
        if self.op.is_some() || env::prepaid_gas() < GAS_OP || !self.lock(Op::Fire, GAS_OP) {
            return self.emit("fire_pending", json!({"trader": trader}));
        }
        self.fetch_fire();
    }

    pub fn finish_fire(&mut self) {
        require!(self.fire_pending, "no fire pending");
        if self.lock(Op::Fire, GAS_OP) {
            self.fetch_fire();
        }
    }

    #[private]
    pub fn on_fire(&mut self, id: u64) {
        if self.stale(id) {
            return;
        }
        self.op = None;
        let value = oracle::read().and_then(|p| self.vault_value(&p));
        // trader stays paused; anyone retries with finish_fire. After FIRE_WAIT_MS it fires anyway
        if value.is_none() && env::block_timestamp_ms() < self.fire_since_ms + FIRE_WAIT_MS {
            let trader = self.trader.as_ref().map(|t| t.account.clone());
            return self.emit("fire_pending", json!({"trader": trader, "why": "no prices"}));
        }
        self.fire_pending = false;
        match value {
            Some(value) => self.crystallize(value, true),
            None => env::log_str("no prices: fired without fee or P/L"),
        }
        if let Some(t) = self.trader.take() {
            self.emit("fired", json!({"trader": t.account}));
            self.record(&t.account, "Fire", 0, 0);
        }
    }

    pub fn resume(&mut self) {
        self.only_dao();
        require!(!self.fire_pending, "fire pending");
        let t = self.trader.as_mut().unwrap_or_else(|| env::panic_str("no trader"));
        require!(t.paused, "not paused");
        t.paused = false;
        self.emit("resumed", json!({}));
    }

    /// New caps also reset budget used. More spend room restarts the trade delay.
    pub fn set_cap(&mut self, budget: U128, max_per_trade: U128) {
        self.only_dao();
        require!(max_per_trade.0 > 0 && max_per_trade.0 <= budget.0, "bad caps");
        let t = self.trader.as_mut().unwrap_or_else(|| env::panic_str("no trader"));
        if budget.0 > t.budget.0.saturating_sub(t.budget_used.0) || max_per_trade.0 > t.max_per_trade.0 {
            self.trade_after_ms = self.trade_after_ms.max(env::block_timestamp_ms() + self.trade_delay_ms);
        }
        t.budget = budget;
        t.max_per_trade = max_per_trade;
        t.budget_used = U128(0);
        self.emit("cap_set", json!({"budget": budget, "max_per_trade": max_per_trade}));
    }
}

impl Vault {
    /// Factory reputation, fire and forget: static gas 0 + weight takes only leftover gas, so it never stalls the op.
    pub(crate) fn record(&self, trader: &AccountId, kind: &str, pnl: i128, fee: u128) {
        // only a hire may create the row; never dip into the reserve leaves and syncs need
        let deposit = if kind == "Hire" && self.free_near() >= STORAGE_RESERVE { RECORD_DEPOSIT } else { NearToken::from_yoctonear(0) };
        let args = json!({"trader": trader, "kind": kind, "pnl_usd_e6": pnl.to_string(), "fee_usd_e6": U128(fee)});
        Promise::new(self.factory.clone())
            .function_call_weight("record_trader".to_string(), args.to_string().into_bytes(), deposit, Gas::from_tgas(0), GasWeight(1))
            .detach();
    }

    fn fetch_fire(&self) {
        oracle::fetch(&self.oracle, self.whitelist.clone())
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_CB).on_fire(self.op_id))
            .detach();
    }
}
