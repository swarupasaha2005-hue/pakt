//! Deposit → shares at current price; leave → pro-rata slice of every token, in kind.
use near_sdk::json_types::U128;
use near_sdk::serde_json::{self, json};
use near_sdk::store::LookupMap;
use near_sdk::{env, ext_contract, near, require, AccountId, Gas, NearToken, PromiseOrValue};

use crate::math::mul_div;
use crate::oracle;
use crate::dao::DAO_STORAGE;
use crate::storage::STORAGE_FEE;
use crate::{Holder, JoinMode, Vault, VaultExt, GAS_DEPOSIT, MAX_MEMBERS, MIN_DEPOSIT_USD_E6, STORAGE_RESERVE};

/// covers member-sync chain spawned for new members
const GAS_DEPOSIT_CB: Gas = Gas::from_tgas(100);
/// 8 payouts (15 each) + member-sync chain (55) + own work; + oracle 15 stays under 300
pub(crate) const GAS_LEAVE_CB: Gas = Gas::from_tgas(230);
pub(crate) const GAS_LEAVE: Gas = Gas::from_tgas(300);
const GAS_TRANSFER: Gas = Gas::from_tgas(10);
const GAS_PAYOUT_CB: Gas = Gas::from_tgas(5);

#[near(serializers = [json])]
struct DepositMsg {
    /// hex ed25519 sig of "pakt-invite:<vault>:<account>"; bound to the joiner so it can't be replayed
    invite_sig: Option<String>,
}

#[ext_contract(ext_ft)]
#[allow(dead_code)]
trait Ft {
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>);
    fn ft_transfer_call(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>, msg: String) -> U128;
    fn ft_balance_of(&self, account_id: AccountId) -> U128;
}

impl Vault {
    /// Pre-checks refund instead of panicking so the depositor sees why in logs.
    pub(crate) fn deposit(&mut self, account: AccountId, amount: U128, msg: String) -> PromiseOrValue<U128> {
        if let Err(why) = self.can_deposit(&account, amount.0, &msg) {
            env::log_str(&format!("refund: {why}"));
            return PromiseOrValue::Value(amount);
        }
        let gen = self.start_flow(GAS_DEPOSIT);
        oracle::fetch(&self.oracle, self.whitelist.clone())
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_DEPOSIT_CB).on_deposit(account, amount, gen))
            .into()
    }

    fn can_deposit(&self, account: &AccountId, amount: u128, msg: &str) -> Result<(), &'static str> {
        if self.op.is_some() {
            return Err("busy, retry");
        }
        if self.is_draining() {
            return Err("draining, retry");
        }
        if amount < self.min_deposit {
            return Err("below min deposit");
        }
        if self.free_near() < STORAGE_RESERVE {
            return Err("vault low on near");
        }
        if self.holders.get(account).is_some_and(|h| h.member) {
            return Ok(());
        }
        self.can_join(account)?;
        if self.join_mode == JoinMode::Invite && !self.invite_ok(account, msg) {
            return Err("bad invite");
        }
        Ok(())
    }

    /// rechecked in on_deposit: deposits overlap, and storage may be unregistered meanwhile
    fn can_join(&self, account: &AccountId) -> Result<(), &'static str> {
        if self.members >= MAX_MEMBERS {
            return Err("pakt full");
        }
        if self.storage.get(account).copied().unwrap_or(0) < STORAGE_FEE.as_yoctonear() {
            return Err("storage_deposit first");
        }
        Ok(())
    }

    fn invite_ok(&self, account: &AccountId, msg: &str) -> bool {
        let (Some(key), Some(sig)) = (self.invite_key, serde_json::from_str::<DepositMsg>(msg).ok().and_then(|m| m.invite_sig)) else {
            return false;
        };
        let Ok(sig) = <[u8; 64]>::try_from(crate::hex_decode_opt(&sig).unwrap_or_default()) else { return false };
        let text = format!("pakt-invite:{}:{account}", env::current_account_id());
        env::ed25519_verify(&sig, text.as_bytes(), &key)
    }

    /// iou row bytes for this leave, worst case a fresh row
    fn iou_cost(&self, account: &AccountId) -> u128 {
        let entries: usize = self.whitelist.iter().zip(&self.at_dex).filter(|(_, a)| **a > 0).map(|(t, _)| 20 + t.len()).sum();
        env::storage_byte_cost().as_yoctonear() * (49 + account.len() + entries) as u128
    }

    /// Ious of a leave; the row is paid from the leaver's storage deposit.
    fn add_ious(&mut self, account: &AccountId, ious: &[(AccountId, u128)]) {
        let before = env::storage_usage();
        let mut row = self.dex_owed.get(account).cloned().unwrap_or_default();
        for (t, a) in ious {
            add_to(&mut row, t, *a);
        }
        self.dex_owed.insert(account.clone(), row);
        self.dex_owed.flush();
        let cost = env::storage_byte_cost().as_yoctonear() * env::storage_usage().saturating_sub(before) as u128;
        if let Some(paid) = self.storage.get_mut(account) {
            *paid = paid.saturating_sub(cost);
        }
        let list: Vec<_> = ious.iter().map(|(t, a)| json!({"token": t, "amount": U128(*a)})).collect();
        self.emit("dex_iou", json!({"account": account, "ious": list}));
    }

    fn pay(&mut self, account: &AccountId, token: &AccountId, amount: u128) {
        *self.paying.entry(account.clone()).or_insert(0) += 1;
        ext_ft::ext(token.clone())
            .with_attached_deposit(NearToken::from_yoctonear(1))
            .with_static_gas(GAS_TRANSFER)
            .ft_transfer(account.clone(), U128(amount), Some("pakt payout".into()))
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_PAYOUT_CB).on_payout(account.clone(), token.clone(), U128(amount)))
            .detach();
    }
}

#[near]
impl Vault {
    /// Returns unused amount to the token's resolver; never panics so the flow always ends.
    #[private]
    pub fn on_deposit(&mut self, account: AccountId, amount: U128, gen: u64) -> U128 {
        if !self.end_flow(gen) {
            return amount;
        }
        let Some(p) = oracle::read() else {
            env::log_str("refund: no prices");
            return amount;
        };
        let (Some(before), Some(dep)) = (self.vault_value(&p), p.value(&self.base_token, amount.0)) else {
            env::log_str("refund: no prices");
            return amount;
        };
        if dep < MIN_DEPOSIT_USD_E6 {
            env::log_str("refund: below $5");
            return amount;
        }
        if !self.holders.get(&account).is_some_and(|h| h.member) {
            if let Err(why) = self.can_join(&account) {
                env::log_str(&format!("refund: {why}"));
                return amount;
            }
        }
        // mark first: new money must not pay fees on profit made before it arrived
        self.crystallize(before, true);
        // orphaned pool (e.g. last leaver's payout came back): platform's, not this depositor's
        if self.total_shares == 0 && before > 0 {
            let platform = self.platform.clone();
            self.mint_fee(&platform, before);
            self.emit("orphan_swept", json!({"platform": platform, "shares": U128(before), "value": U128(before)}));
        }
        let shares = if self.total_shares == 0 { dep } else { mul_div(dep, self.total_shares, before) };
        if shares == 0 {
            env::log_str("refund: zero shares");
            return amount;
        }
        self.balances[0] += amount.0;
        self.total_shares += shares;
        let now = env::block_timestamp_ms();
        let h = self.holders.entry(account.clone()).or_insert(Holder { shares: U128(0), member: false, joined_ms: now });
        h.shares.0 += shares;
        let joined = !h.member;
        if joined {
            h.member = true;
            h.joined_ms = now;
            self.members += 1;
        }
        if self.hwm == 0 {
            self.hwm = self.share_price(before + dep);
        }
        self.emit("deposit", json!({"account": account, "amount": amount, "shares": U128(shares), "value": U128(dep)}));
        if joined {
            self.queue_sync(account);
        }
        U128(0)
    }

    /// Burn `shares` for a slice of every token. Fees are marked first so leaving never dodges them.
    pub fn leave(&mut self, shares: U128) {
        let account = env::predecessor_account_id();
        let held = self.holders.get(&account).map_or(0, |h| h.shares.0);
        require!(shares.0 > 0 && shares.0 <= held, "not enough shares");
        // tokens at ref become an iou, so at_dex must mirror ref; anyone can dex_recover
        let parked = self.at_dex.iter().any(|a| *a > 0);
        require!(!parked || self.dex_synced, "funds at dex: call dex_recover first");
        let paid = self.storage.get(&account).copied().unwrap_or(0);
        require!(!parked || paid >= self.iou_cost(&account) + DAO_STORAGE.as_yoctonear(), "storage_deposit first: funds at dex need an iou row");
        let gen = self.start_flow(GAS_LEAVE);
        oracle::fetch(&self.oracle, self.whitelist.clone())
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_LEAVE_CB).on_leave(account, shares, gen))
            .detach();
    }

    #[private]
    pub fn on_leave(&mut self, account: AccountId, shares: U128, gen: u64) {
        if !self.end_flow(gen) {
            return;
        }
        // oracle down must never trap funds: pay out in kind, skip the fee mark
        match oracle::read().and_then(|p| self.vault_value(&p)) {
            Some(value) => self.crystallize(value, true),
            None => env::log_str("no prices: leaving without fee mark"),
        }
        let Some(h) = self.holders.get(&account).cloned() else { return };
        let shares = shares.0.min(h.shares.0);
        let (mut payouts, mut ious) = (vec![], vec![]);
        for i in 0..self.whitelist.len() {
            let amt = mul_div(self.balances[i], shares, self.total_shares);
            if amt > 0 {
                self.balances[i] -= amt;
                self.out[i] += amt;
                payouts.push((self.whitelist[i].clone(), amt));
            }
            // slice still at ref leaves pool value as an iou, claimable after dex_recover
            let iou = mul_div(self.at_dex[i], shares, self.total_shares);
            if iou > 0 {
                self.at_dex[i] -= iou;
                self.dex_iou[i] += iou;
                ious.push((self.whitelist[i].clone(), iou));
            }
        }
        self.total_shares -= shares;
        let rest = h.shares.0 - shares;
        if rest == 0 {
            self.holders.remove(&account);
        } else {
            self.holders.insert(account.clone(), Holder { shares: U128(rest), ..h.clone() });
        }
        if self.total_shares == 0 {
            self.hwm = 0;
        }
        for (token, amt) in &payouts {
            self.pay(&account, token, *amt);
        }
        let list: Vec<_> = payouts.iter().map(|(t, a)| json!({"token": t, "amount": U128(*a)})).collect();
        self.emit("leave", json!({"account": account, "shares": U128(shares), "payouts": list}));
        if !ious.is_empty() {
            self.add_ious(&account, &ious);
        }
        if rest == 0 && h.member {
            self.members -= 1;
            self.queue_sync(account);
        }
    }

    /// Failed transfer (e.g. receiver not registered) parks the amount for `claim`.
    /// No NEAR for the owed row: back to the pool ledger, so tokens are never orphaned.
    #[private]
    pub fn on_payout(&mut self, account: AccountId, token: AccountId, amount: U128) {
        match self.paying.get(&account).copied().unwrap_or(1) {
            1 => self.paying.remove(&account),
            n => self.paying.insert(account.clone(), n - 1),
        };
        let i = self.token_index(&token);
        if crate::promise_ok(64).is_some() {
            self.out[i] = self.out[i].saturating_sub(amount.0);
            return;
        }
        let prev = self.owed.get(&account).cloned();
        let mut owed = prev.clone().unwrap_or_default();
        add_to(&mut owed, &token, amount.0);
        self.owed.insert(account.clone(), owed);
        self.owed.flush();
        if !self.free_near().is_zero() {
            return;
        }
        match prev {
            Some(p) => self.owed.insert(account, p),
            None => self.owed.remove(&account),
        };
        self.out[i] = self.out[i].saturating_sub(amount.0);
        self.balances[i] += amount.0;
        env::log_str("payout failed, no near for owed: back to pool");
    }

    /// Retry a parked payout, e.g. after registering on the token, or take a dex iou once it is home.
    pub fn claim(&mut self, token: AccountId) {
        let account = env::predecessor_account_id();
        let amount = match take(&mut self.owed, &account, &token) {
            Some(a) => a,
            None => {
                let i = self.token_index(&token);
                let iou = self.dex_owed.get(&account).and_then(|r| r.iter().find(|(t, _)| *t == token)).map_or(0, |(_, a)| a.0);
                require!(self.iou_home[i] >= iou, "iou still at dex: call dex_recover");
                let a = take(&mut self.dex_owed, &account, &token).unwrap_or_else(|| env::panic_str("nothing owed"));
                self.iou_home[i] -= a;
                self.out[i] += a;
                a
            }
        };
        self.pay(&account, &token, amount);
        self.emit("claim", json!({"account": account, "token": token, "amount": U128(amount)}));
    }
}

fn add_to(row: &mut Vec<(AccountId, U128)>, token: &AccountId, amount: u128) {
    match row.iter_mut().find(|(t, _)| t == token) {
        Some((_, a)) => a.0 += amount,
        None => row.push((token.clone(), U128(amount))),
    }
}

/// removes `token` from the account's row; None if absent
fn take(map: &mut LookupMap<AccountId, Vec<(AccountId, U128)>>, account: &AccountId, token: &AccountId) -> Option<u128> {
    let mut row = map.get(account).cloned()?;
    let i = row.iter().position(|(t, _)| t == token)?;
    let (_, amount) = row.remove(i);
    if row.is_empty() {
        map.remove(account);
    } else {
        map.insert(account.clone(), row);
    }
    Some(amount.0)
}
