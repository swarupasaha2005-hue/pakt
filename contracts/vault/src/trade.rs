//! Trader swaps on Ref (Rhea): deposit → swap → withdraw, so the vault learns the exact amount_out.
//! Funds inside Ref sit in `at_dex`: value math counts them, a failed hop leaves them for `dex_recover`.
use std::collections::HashMap;

use near_sdk::json_types::U128;
use near_sdk::serde_json::{self, json};
use near_sdk::{env, ext_contract, near, require, AccountId, Gas, GasWeight, NearToken, Promise};

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
/// nep-145 min for a token account row; excess is refunded to us
pub const FT_REG: NearToken = NearToken::from_micronear(1250);
const GAS_FT_REG: Gas = Gas::from_tgas(3);
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
const GAS_ON_BALANCE: Gas = Gas::from_tgas(10);
const GAS_RECONCILE: Gas = Gas::from_tgas(30);

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

/// Ref account + token rows in one batch, then us on every token; FT_REG each comes from the vault's own NEAR.
/// Token regs share init's spare gas by weight, so the factory reserves little per token.
pub(crate) fn register_dex(dex: &AccountId, tokens: &[AccountId]) {
    Promise::new(dex.clone())
        .function_call("storage_deposit".to_string(), b"{}".to_vec(), DEX_STORAGE, GAS_REG)
        .function_call("register_tokens".to_string(), json!({"token_ids": tokens}).to_string().into_bytes(), ONE, GAS_REG)
        .detach();
    let reg = json!({"account_id": env::current_account_id(), "registration_only": true}).to_string().into_bytes();
    for t in tokens {
        Promise::new(t.clone()).function_call_weight("storage_deposit".to_string(), reg.clone(), FT_REG, GAS_FT_REG, GasWeight(1)).detach();
    }
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
        if !self.lock(Op::Trade, GAS_OP) {
            return;
        }
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
        // leaky bucket: holds half the 24h budget and refills that half per day, so any 24h span stays under it
        let cap = mul_div(total, MAX_PERIOD_SLIP_BPS, 2 * BPS);
        let now = env::block_timestamp_ms();
        let refill = mul_div(cap, now.saturating_sub(self.slip_since_ms) as u128, DAY_MS as u128);
        (self.slip_used, self.slip_since_ms) = (self.slip_used.saturating_sub(refill), now);
        // worst case this swap loses the full oracle floor
        if self.slip_used + mul_div(value, MAX_SLIPPAGE_BPS, BPS) > cap {
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
        // unreadable result: tokens may be at ref, so keep them in at_dex; dex_recover + reconcile settle it
        let Some(used) = result_u128() else {
            self.dex_synced = false;
            return self.refuse("dex deposit unknown, call dex_recover");
        };
        let used = used.min(amount_in.0);
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
        let got = result_u128().unwrap_or(0).min(amount.0);
        // recover also pulls leaver ious: fill those first
        let iou = if self.op == Some(Op::Recover) { got.min(self.dex_iou[i]) } else { 0 };
        self.op = None;
        self.dex_iou[i] -= iou;
        self.iou_home[i] += iou;
        let got = (got - iou).min(self.at_dex[i]);
        self.at_dex[i] -= got;
        self.balances[i] += got;
        if got + iou < amount.0 {
            env::log_str("dex withdraw failed: funds stay at dex, call dex_recover");
        }
    }

    /// Anyone may pull parked funds home from ref. Resyncs at_dex from ref first: a dead hop leaves it naming the wrong token.
    pub fn dex_recover(&mut self, token: AccountId) {
        let i = self.token_index(&token);
        require!(self.at_dex.iter().chain(&self.dex_iou).any(|a| *a > 0), "nothing at dex");
        if !self.lock(Op::Recover, GAS_OP) {
            return;
        }
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
        for k in 0..self.whitelist.len() {
            // ref holds pool + ious; a pool shortfall may have come home already, so park it for reconcile
            let pool = d.get(&self.whitelist[k]).map_or(0, |a| a.0).saturating_sub(self.dex_iou[k]);
            self.suspense[k] += self.at_dex[k].saturating_sub(pool);
            self.at_dex[k] = pool;
        }
        self.dex_synced = true;
        self.dex_withdraw(i, self.at_dex[i] + self.dex_iou[i]);
    }

    /// Anyone: credits suspense back to the pool, but only what the token says we hold beyond the ledger.
    pub fn reconcile(&mut self, token: AccountId) {
        let i = self.token_index(&token);
        require!(self.suspense[i] > 0, "nothing in suspense");
        if !self.lock(Op::Recover, GAS_RECONCILE) {
            return;
        }
        ext_ft::ext(token)
            .with_static_gas(GAS_VIEW)
            .ft_balance_of(env::current_account_id())
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_ON_BALANCE).on_reconcile(i, env::block_height(), self.op_id))
            .detach();
    }

    #[private]
    pub fn on_reconcile(&mut self, i: usize, since: u64, id: u64) {
        if self.stale(id) {
            return;
        }
        self.op = None;
        let Some(chain) = result_u128() else { return env::log_str("reconcile: balance read failed, retry") };
        // an ft_transfer_call refund in flight shows in the balance but is not ours
        if self.inbound_block + 3 >= since {
            return env::log_str("reconcile: transfer raced the read, retry");
        }
        let held = self.balances[i] + self.out[i] + self.iou_home[i];
        let credit = self.suspense[i].min(chain.saturating_sub(held));
        self.suspense[i] -= credit;
        self.balances[i] += credit;
        let token = self.whitelist[i].clone();
        self.emit("reconciled", json!({"token": token, "amount": U128(credit)}));
    }
}
