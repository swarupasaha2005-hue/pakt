//! Keeps the sputnik `members` role equal to depositors: vault proposes + approves alone via its `vault` role.
//! A failed sync stays in `pending_sync`; anyone may retry with `sync_member`.
use near_sdk::serde_json::{self, json, Value};
use near_sdk::{env, ext_contract, near, require, AccountId, Gas, NearToken, Promise, PromiseOrValue};

use crate::{Vault, VaultExt};

pub const MEMBERS_ROLE: &str = "members";
/// sent to the dao per sync: pays its stored proposal (~233 bytes measured)
pub const DAO_STORAGE: NearToken = NearToken::from_micronear(3_000);
const GAS_PROPOSE: Gas = Gas::from_tgas(15);
const GAS_ACT: Gas = Gas::from_tgas(25);
const GAS_ON_SYNCED: Gas = Gas::from_tgas(5);
const GAS_ON_PROPOSED: Gas = Gas::from_tgas(40);

#[ext_contract(ext_dao)]
#[allow(dead_code)]
trait Sputnik {
    fn add_proposal(&mut self, proposal: Value) -> u64;
    /// v3 needs `proposal` to match the stored kind; v2 ignores it
    fn act_proposal(&mut self, id: u64, action: String, proposal: Value, memo: Option<String>);
}

fn kind(account: &AccountId, add: bool) -> Value {
    let k = if add { "AddMemberToRole" } else { "RemoveMemberFromRole" };
    json!({ k: {"member_id": account, "role": MEMBERS_ROLE} })
}

impl Vault {
    pub(crate) fn queue_sync(&mut self, account: AccountId) {
        self.pending_sync.insert(account.clone());
        // dao fee comes from the account's storage deposit; low NEAR must not panic the callback
        let paid = self.storage.get(&account).copied().unwrap_or(0);
        let locked = env::storage_byte_cost().saturating_mul(env::storage_usage() as u128 + 1_000);
        let free = env::account_balance().saturating_sub(locked).as_yoctonear();
        if paid < DAO_STORAGE.as_yoctonear() || free < self.dao_bond + DAO_STORAGE.as_yoctonear() {
            return env::log_str("member sync: low storage or balance, call sync_member");
        }
        self.storage.insert(account.clone(), paid - DAO_STORAGE.as_yoctonear());
        self.start_sync(account).detach();
    }

    pub(crate) fn wants_member(&self, account: &AccountId) -> bool {
        self.holders.get(account).is_some_and(|h| h.member && h.shares.0 > 0)
    }

    fn start_sync(&self, account: AccountId) -> Promise {
        let add = self.wants_member(&account);
        let proposal = json!({"description": "pakt member sync", "kind": kind(&account, add)});
        Promise::new(self.dao.clone()).transfer(DAO_STORAGE).detach();
        ext_dao::ext(self.dao.clone())
            .with_attached_deposit(NearToken::from_yoctonear(self.dao_bond))
            .with_static_gas(GAS_PROPOSE)
            .add_proposal(proposal)
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_ON_PROPOSED).on_proposed(account, add))
    }
}

#[near]
impl Vault {
    /// Retry a failed sync. Caller pays bond + DAO_STORAGE so retries can't drain the vault.
    #[payable]
    pub fn sync_member(&mut self, account: AccountId) -> Promise {
        require!(self.pending_sync.contains(&account), "already in sync");
        let need = self.dao_bond + DAO_STORAGE.as_yoctonear();
        let attached = env::attached_deposit().as_yoctonear();
        require!(attached >= need, "attach dao bond + 0.003 NEAR");
        if attached > need {
            Promise::new(env::predecessor_account_id()).transfer(NearToken::from_yoctonear(attached - need)).detach();
        }
        self.start_sync(account)
    }

    #[private]
    pub fn on_proposed(&mut self, account: AccountId, add: bool) -> PromiseOrValue<bool> {
        let Some(id) = crate::promise_ok(64).and_then(|v| serde_json::from_slice::<u64>(&v).ok()) else {
            env::log_str("member sync: propose failed");
            return PromiseOrValue::Value(false);
        };
        ext_dao::ext(self.dao.clone())
            .with_static_gas(GAS_ACT)
            .act_proposal(id, "VoteApprove".into(), kind(&account, add), None)
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_ON_SYNCED).on_synced(account, add))
            .into()
    }

    #[private]
    pub fn on_synced(&mut self, account: AccountId, add: bool) {
        if crate::promise_ok(64).is_none() {
            return env::log_str("member sync: approve failed");
        }
        // membership may have flipped while in flight: clear on match, else (re)mark for sync_member
        if self.wants_member(&account) == add {
            self.pending_sync.remove(&account);
        } else {
            self.pending_sync.insert(account.clone());
        }
        self.emit("member_synced", json!({"account": account, "added": add}));
    }
}
