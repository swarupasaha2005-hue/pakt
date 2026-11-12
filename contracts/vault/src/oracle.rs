//! Burrow-style price oracle (`priceoracle.near`): get_price_data → per-asset multiplier/decimals.
use near_sdk::json_types::U128;
use near_sdk::{ext_contract, near, AccountId, Gas, Promise};

use crate::math::{raw_from_usd_e6, usd_e6};

pub const GAS_PRICES: Gas = Gas::from_tgas(15);

#[near(serializers = [json])]
#[derive(Clone)]
pub struct Price {
    pub multiplier: U128,
    pub decimals: u8,
}

#[near(serializers = [json])]
pub struct AssetPrice {
    pub asset_id: AccountId,
    /// null when the oracle has no fresh reports
    pub price: Option<Price>,
}

/// json only: also rides along trade callbacks so every hop uses one price set
#[near(serializers = [json])]
pub struct PriceData {
    pub timestamp: near_sdk::json_types::U64,
    pub recency_duration_sec: u32,
    pub prices: Vec<AssetPrice>,
}

#[ext_contract(ext_oracle)]
#[allow(dead_code)]
trait Oracle {
    fn get_price_data(&self, asset_ids: Option<Vec<AccountId>>) -> PriceData;
}

pub fn fetch(oracle: &AccountId, tokens: Vec<AccountId>) -> Promise {
    ext_oracle::ext(oracle.clone()).with_static_gas(GAS_PRICES).get_price_data(Some(tokens))
}

/// Parsed result of the price promise; None on failure. Never panics: callers must unlock.
pub fn read() -> Option<PriceData> {
    near_sdk::serde_json::from_slice(&crate::promise_ok(16_384)?).ok()
}

impl PriceData {
    /// usd e6 of `raw` units of `token`; None when token has no fresh price
    pub fn value(&self, token: &AccountId, raw: u128) -> Option<u128> {
        if raw == 0 {
            return Some(0);
        }
        let p = self.prices.iter().find(|a| &a.asset_id == token)?.price.as_ref()?;
        Some(usd_e6(raw, p.multiplier.0, p.decimals))
    }

    /// raw units of `token` worth `usd` e6; None without a usable price
    pub fn amount(&self, token: &AccountId, usd: u128) -> Option<u128> {
        let p = self.prices.iter().find(|a| &a.asset_id == token)?.price.as_ref().filter(|p| p.multiplier.0 > 0)?;
        Some(raw_from_usd_e6(usd, p.multiplier.0, p.decimals))
    }
}
