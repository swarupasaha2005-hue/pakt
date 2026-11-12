//! Fees only on new profit above the per-share high-water mark, paid as freshly minted shares.
use near_sdk::json_types::U128;
use near_sdk::serde_json::json;
use near_sdk::{env, near, require, AccountId, Gas};

use crate::math::mul_div;
use crate::oracle::{self, PriceData};
use crate::{Holder, Vault, VaultExt, BPS, GAS_OP, PLATFORM_FEE_BPS, PRICE_SCALE};

const GAS_SETTLE_CB: Gas = Gas::from_tgas(30);

impl Vault {
    /// usd e6 of everything held; None when a held token has no fresh price
    pub(crate) fn vault_value(&self, p: &PriceData) -> Option<u128> {
        let held = self.balances.iter().zip(&self.at_dex).map(|(b, d)| b + d);
        self.whitelist.iter().zip(held).try_fold(0u128, |acc, (t, b)| Some(acc + p.value(t, b)?))
    }

    pub(crate) fn share_price(&self, value: u128) -> u128 {
        if self.total_shares == 0 {
            PRICE_SCALE
        } else {
            mul_div(value, PRICE_SCALE, self.total_shares)
        }
    }

    /// Mark profit: fees to trader + platform when `charge` and a trader is live, then raise the mark.
    /// Without a trader the mark still rises, so a later trader is never paid for gains before them.
    pub(crate) fn crystallize(&mut self, value: u128, charge: bool) {
        if self.total_shares == 0 {
            return;
        }
        let price = self.share_price(value);
        self.check_stop_loss(price);
        if price <= self.hwm {
            return;
        }
        let profit = mul_div(price - self.hwm, self.total_shares, PRICE_SCALE);
        let fee_bps = self.trader.as_ref().filter(|_| charge).map(|t| t.fee_bps as u128);
        let (mut ts, mut ps) = (0, 0);
        if let Some(fee_bps) = fee_bps {
            let (tf, pf) = (profit * fee_bps / BPS, profit * PLATFORM_FEE_BPS / BPS);
            // new shares worth exactly the fee after minting: fee * S / (V - fees)
            let rest = value - tf - pf;
            ts = mul_div(tf, self.total_shares, rest);
            ps = mul_div(pf, self.total_shares, rest);
            let trader = self.trader.as_ref().unwrap().account.clone();
            self.mint_fee(&trader, ts);
            let platform = self.platform.clone();
            self.mint_fee(&platform, ps);
        }
        self.hwm = self.share_price(value);
        self.emit(
            "settled",
            json!({"share_price": U128(self.hwm), "hwm": U128(self.hwm), "profit": U128(profit),
                   "trader_fee_shares": U128(ts), "platform_fee_shares": U128(ps)}),
        );
    }

    pub(crate) fn mint_fee(&mut self, to: &AccountId, shares: u128) {
        if shares == 0 {
            return;
        }
        let h = self.holders.entry(to.clone()).or_insert(Holder { shares: U128(0), member: false, joined_ms: env::block_timestamp_ms() });
        h.shares.0 += shares;
        self.total_shares += shares;
    }

    pub(crate) fn check_stop_loss(&mut self, price: u128) {
        let hwm = self.hwm;
        let Some(t) = self.trader.as_mut().filter(|t| !t.paused) else { return };
        if price < mul_div(hwm, BPS - t.stop_loss_bps as u128, BPS) {
            t.paused = true;
            self.emit("paused", json!({"reason": "stop_loss"}));
        }
    }
}

#[near]
impl Vault {
    /// Periodic mark (settle_period_ms), anyone may call. Deposits, leaves and fire also mark first.
    pub fn settle(&mut self) {
        require!(self.total_shares > 0, "empty vault");
        require!(env::block_timestamp_ms() >= self.last_settle_ms + self.settle_period_ms, "settled too recently");
        let gen = self.start_flow(GAS_OP);
        oracle::fetch(&self.oracle, self.whitelist.clone())
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_SETTLE_CB).on_settle(gen))
            .detach();
    }

    #[private]
    pub fn on_settle(&mut self, gen: u64) {
        if !self.end_flow(gen) {
            return;
        }
        let Some(value) = oracle::read().and_then(|p| self.vault_value(&p)) else {
            return env::log_str("settle skipped: no prices");
        };
        self.crystallize(value, true);
        self.last_settle_ms = env::block_timestamp_ms();
    }
}
