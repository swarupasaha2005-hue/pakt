//! Trader swaps on Ref (Rhea): deposit → swap → withdraw, so the vault learns the exact amount_out.
//! Funds inside Ref sit in `at_dex`: value math counts them, a failed hop leaves them for `dex_recover`.
use std::collections::HashMap;

use near_sdk::json_types::U128;
use near_sdk::serde_json::{self, json};
use near_sdk::{env, ext_contract, near, require, AccountId, Gas, NearToken, Promise};

use crate::math::mul_div;
use crate::oracle::{self, PriceData};
use crate::shares::ext_ft;
use crate::trader::Trader;
use crate::{Op, Vault, VaultExt, BPS, DAY_MS, GAS_OP};

/// oracle floor on every swap: a rigged pool can't take more than this
pub const MAX_SLIPPAGE_BPS: u128 = 200;
/// realized swap loss vs oracle allowed per settle period, of vault value
pub const MAX_PERIOD_SLIP_BPS: u128 = 300;
/// ref account + 8 token rows ~1.3KB; factory adds it to required_deposit
pub const DEX_STORAGE: NearToken = NearToken::from_millinear(50);
const ONE: NearToken = NearToken::from_yoctonear(1);
const GAS_REG: Gas = Gas::from_tgas(10);
// hop budgets: callee gas, then each callback = own work + its call + the next callback
const GAS_FT_CALL: Gas = Gas::from_tgas(50);
const GAS_SWAP: Gas = Gas::from_tgas(30);
const GAS_WITHDRAW: Gas = Gas::from_tgas(50);
const GAS_ON_WITHDRAW: Gas = Gas::from_tgas(10);
const GAS_ON_SWAP: Gas = Gas::from_tgas(75);
const GAS_ON_DEPOSIT: Gas = Gas::from_tgas(115);
const GAS_ON_PRICES: Gas = Gas::from_tgas(180);
const GAS_VIEW: Gas = Gas::from_tgas(10);
const GAS_ON_DEPOSITS: Gas = Gas::from_tgas(80);

#[near(serializers = [json])]
pub struct SwapAction {
    pub pool_id: u64,
    pub token_in: AccountId,
    pub amount_in: Option<U128>,
    pub token_out: AccountId,
    pub min_amount_out: U128,
}

/// ref-exchange 1.9.x
#[ext_contract(ext_ref)]
#[allow(dead_code)]
trait Ref {
    fn swap(&mut self, actions: Vec<SwapAction>, referral_id: Option<AccountId>, skip_degen_price_sync: Option<bool>) -> U128;
    /// resolves to the amount sent, 0 if the transfer bounced back into our ref deposit
    fn withdraw(&mut self, token_id: AccountId, amount: U128, unregister: Option<bool>, skip_unwrap_near: Option<bool>) -> U128;
    fn get_deposits(&self, account_id: AccountId) -> HashMap<AccountId, U128>;
}

/// Ref account + token rows in one batch; token rows let deposits work for non-whitelisted tokens too.
pub(crate) fn register_dex(dex: &AccountId, tokens: &[AccountId]) {
    Promise::new(dex.clone())
        .function_call("storage_deposit".to_string(), b"{}".to_vec(), DEX_STORAGE, GAS_REG)
        .function_call("register_tokens".to_string(), json!({"token_ids": tokens}).to_string().into_bytes(), ONE, GAS_REG)
        .detach();
}

/// usd e6 of the input and the oracle floor on the output; None without both prices
pub(crate) fn quote(p: &PriceData, token_in: &AccountId, amount_in: u128, token_out: &AccountId) -> Option<(u128, u128)> {
    let value = p.value(token_in, amount_in)?;
    let out = p.amount(token_out, value)?;
    Some((value, mul_div(out, BPS - MAX_SLIPPAGE_BPS, BPS)))
}

pub(crate) fn within_caps(t: &Trader, value: u128) -> Result<(), &'static str> {
    if value > t.max_per_trade.0 {
        return Err("over max per trade");
    }
    if t.budget_used.0 + value > t.budget.0 {
        return Err("over budget");
    }
    Ok(())
}

fn result_u128() -> Option<u128> {
    crate::promise_ok(64).and_then(|v| serde_json::from_slice::<U128>(&v).ok()).map(|x| x.0)
}

impl Vault {
    fn refuse(&mut self, why: &str) {
        self.op = None;
        env::log_str(&format!("trade refused: {why}"));
    }

    /// Lock stays held until this lands; amount 0 would mean "withdraw all" at ref, so skip it.
    fn dex_withdraw(&mut self, i: usize, amount: u128) {
        if amount == 0 {
            self.op = None;
            return;
        }
        ext_ref::ext(self.dex.clone())
            .with_attached_deposit(ONE)
            .with_static_gas(GAS_WITHDRAW)
            .withdraw(self.whitelist[i].clone(), U128(amount), None, Some(true))
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_ON_WITHDRAW).on_dex_withdraw(i, U128(amount), self.op_id))
            .detach();
    }
}

#[near]
impl Vault {
    /// Swap within caps on a ref pool. min_out is raised to the oracle price minus MAX_SLIPPAGE_BPS.
    pub fn trade(&mut self, pool_id: u64, token_in: AccountId, token_out: AccountId, amount_in: U128, min_out: U128) {
        let t = self.trader.as_ref().unwrap_or_else(|| env::panic_str("no trader"));
        require!(t.account == env::predecessor_account_id(), "only trader");
        require!(!t.paused, "trader paused");
        require!(env::block_timestamp_ms() >= self.trade_after_ms, "trade delay: wait for trade_after_ms");
        let (i, o) = (self.token_index(&token_in), self.token_index(&token_out));
        require!(i != o, "same token");
        require!(amount_in.0 > 0 && amount_in.0 <= self.balances[i], "not enough balance");
        self.lock(Op::Trade, GAS_OP);
        oracle::fetch(&self.oracle, self.whitelist.clone())
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_ON_PRICES).on_trade_prices(pool_id, i, o, amount_in, min_out, self.op_id))
            .detach();
    }

    #[private]
    pub fn on_trade_prices(&mut self, pool_id: u64, i: usize, o: usize, amount_in: U128, min_out: U128, id: u64) {
        if self.stale(id) {
            return;
        }
        let Some(p) = oracle::read() else { return self.refuse("no prices") };
        // whole-vault value needed after the swap for the stop-loss check
        let q = quote(&p, &self.whitelist[i], amount_in.0, &self.whitelist[o]).zip(self.vault_value(&p));
        let Some(((value, floor), total)) = q else { return self.refuse("no prices") };
        let Some(t) = self.trader.as_ref() else { return self.refuse("no trader") };
        if let Err(why) = within_caps(t, value) {
            return self.refuse(why);
        }
        let now = env::block_timestamp_ms();
        if now >= self.slip_since_ms + DAY_MS {
            (self.slip_used, self.slip_since_ms) = (0, now);
        }
        // worst case this swap loses the full oracle floor
        if self.slip_used + mul_div(value, MAX_SLIPPAGE_BPS, BPS) > mul_div(total, MAX_PERIOD_SLIP_BPS, BPS) {
            return self.refuse("period slippage budget used, wait for the 24h window");
        }
        self.balances[i] -= amount_in.0;
        self.at_dex[i] += amount_in.0;
        let min = U128(min_out.0.max(floor));
        ext_ft::ext(self.whitelist[i].clone())
            .with_attached_deposit(ONE)
            .with_static_gas(GAS_FT_CALL)
            .ft_transfer_call(self.dex.clone(), amount_in, None, String::new())
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_ON_DEPOSIT).on_dex_deposit(pool_id, i, o, amount_in, min, U128(value), p, id))
            .detach();
    }

    /// ft_transfer_call resolves to the amount ref kept; a failed call moved nothing.
    #[private]
    #[allow(clippy::too_many_arguments)]
    pub fn on_dex_deposit(&mut self, pool_id: u64, i: usize, o: usize, amount_in: U128, min_out: U128, value: U128, p: PriceData, id: u64) {
        if self.stale(id) {
            return;
        }
        let used = result_u128().unwrap_or(0).min(amount_in.0);
        self.at_dex[i] -= amount_in.0 - used;
        self.balances[i] += amount_in.0 - used;
        if used != amount_in.0 {
            // a partial deposit stays tracked in at_dex for dex_recover
            return self.refuse("dex deposit failed");
        }
        let action = SwapAction {
            pool_id,
            token_in: self.whitelist[i].clone(),
            amount_in: Some(amount_in),
            token_out: self.whitelist[o].clone(),
            min_amount_out: min_out,
        };
        ext_ref::ext(self.dex.clone())
            .with_attached_deposit(ONE)
            .with_static_gas(GAS_SWAP)
            .swap(vec![action], None, None)
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_ON_SWAP).on_swap(i, o, amount_in, value, p, id))
            .detach();
    }

    /// Swap failed (e.g. under the oracle floor): pull the input back. Else book it and pull the output.
    #[private]
    pub fn on_swap(&mut self, i: usize, o: usize, amount_in: U128, value: U128, p: PriceData, id: u64) {
        if self.stale(id) {
            return;
        }
        let Some(out) = result_u128() else {
            env::log_str("trade refused: swap failed, withdrawing input");
            return self.dex_withdraw(i, amount_in.0);
        };
        self.at_dex[i] -= amount_in.0;
        self.at_dex[o] += out;
        self.slip_used += value.0.saturating_sub(p.value(&self.whitelist[o], out).unwrap_or(0));
        if let Some(t) = self.trader.as_mut() {
            t.budget_used.0 += value.0;
            let trader = t.account.clone();
            let (tin, tout) = (self.whitelist[i].clone(), self.whitelist[o].clone());
            self.emit(
                "trade",
                json!({"trader": trader, "token_in": tin, "amount_in": amount_in, "token_out": tout, "amount_out": U128(out), "value": value}),
            );
        }
        if let Some(v) = self.vault_value(&p) {
            let price = self.share_price(v);
            self.check_stop_loss(price);
        }
        self.dex_withdraw(o, out);
    }

    /// Credits what ref actually sent; the rest stays in at_dex.
    #[private]
    pub fn on_dex_withdraw(&mut self, i: usize, amount: U128, id: u64) {
        if self.stale(id) {
            return;
        }
        self.op = None;
        let got = result_u128().unwrap_or(0).min(amount.0).min(self.at_dex[i]);
        self.at_dex[i] -= got;
        self.balances[i] += got;
        if got < amount.0 {
            env::log_str("dex withdraw failed: funds stay at dex, call dex_recover");
        }
    }

    /// Anyone may pull parked funds home from ref. Resyncs at_dex from ref first: a dead hop leaves it naming the wrong token.
    pub fn dex_recover(&mut self, token: AccountId) {
        let i = self.token_index(&token);
        require!(self.at_dex.iter().any(|a| *a > 0), "nothing at dex");
        self.lock(Op::Recover, GAS_OP);
        ext_ref::ext(self.dex.clone())
            .with_static_gas(GAS_VIEW)
            .get_deposits(env::current_account_id())
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_ON_DEPOSITS).on_dex_deposits(i, self.op_id))
            .detach();
    }

    /// Lock held, nothing else moves funds to or from ref, so its deposits are exactly what is not home.
    #[private]
    pub fn on_dex_deposits(&mut self, i: usize, id: u64) {
        if self.stale(id) {
            return;
        }
        let Some(d) = crate::promise_ok(4096).and_then(|v| serde_json::from_slice::<HashMap<AccountId, U128>>(&v).ok()) else {
            self.op = None;
            return env::log_str("dex recover: get_deposits failed, retry");
        };
        self.at_dex = self.whitelist.iter().map(|t| d.get(t).map_or(0, |a| a.0)).collect();
        self.dex_withdraw(i, self.at_dex[i]);
    }
}
