//! NEP-145 style storage: each joiner prepays its holder/owed/sync rows + dao sync fees, so churn never spends vault NEAR.
use near_sdk::json_types::U128;
use near_sdk::{env, near, require, AccountId, NearToken, Promise};

use crate::{Vault, VaultExt};

/// holder + owed + pending_sync rows (~400 bytes) and two dao syncs (join + leave)
pub const STORAGE_FEE: NearToken = NearToken::from_millinear(10);

#[near(serializers = [json])]
pub struct StorageBalance {
    pub total: U128,
    pub available: U128,
}

#[near(serializers = [json])]
pub struct StorageBalanceBounds {
    pub min: U128,
    pub max: Option<U128>,
}

#[near]
impl Vault {
    /// Tops the account up to STORAGE_FEE; the rest of the deposit is refunded.
    #[payable]
    pub fn storage_deposit(&mut self, account_id: Option<AccountId>, registration_only: Option<bool>) -> StorageBalance {
        let _ = registration_only;
        let account = account_id.unwrap_or_else(env::predecessor_account_id);
        let have = self.storage.get(&account).copied().unwrap_or(0);
        let need = STORAGE_FEE.as_yoctonear().saturating_sub(have);
        let attached = env::attached_deposit().as_yoctonear();
        require!(attached >= need, format!("attach at least {need} yoctoNEAR"));
        if need > 0 {
            self.storage.insert(account.clone(), STORAGE_FEE.as_yoctonear());
        }
        if attached > need {
            Promise::new(env::predecessor_account_id()).transfer(NearToken::from_yoctonear(attached - need)).detach();
        }
        self.storage_balance_of(account).unwrap()
    }

    /// Refunds what is left once the account holds no shares, owes nothing and has no sync in flight.
    #[payable]
    pub fn storage_unregister(&mut self, force: Option<bool>) -> bool {
        require!(env::attached_deposit().as_yoctonear() == 1, "attach 1 yoctoNEAR");
        require!(force != Some(true), "force not supported");
        let account = env::predecessor_account_id();
        let Some(left) = self.storage.get(&account).copied() else { return false };
        require!(self.holders.get(&account).is_none() && self.owed.get(&account).is_none(), "holds shares or owed tokens");
        require!(!self.pending_sync.contains(&account), "member sync pending");
        self.storage.remove(&account);
        if left > 0 {
            Promise::new(account).transfer(NearToken::from_yoctonear(left)).detach();
        }
        true
    }

    pub fn storage_balance_of(&self, account_id: AccountId) -> Option<StorageBalance> {
        self.storage.get(&account_id).map(|t| StorageBalance { total: U128(*t), available: U128(0) })
    }

    pub fn storage_balance_bounds(&self) -> StorageBalanceBounds {
        StorageBalanceBounds { min: U128(STORAGE_FEE.as_yoctonear()), max: Some(U128(STORAGE_FEE.as_yoctonear())) }
    }
}
