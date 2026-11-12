//! mock nep-141: tUSDC, tBTC. owner mints for demo seeding.
use near_contract_standards::fungible_token::core::FungibleTokenCore;
use near_contract_standards::fungible_token::metadata::{
    FungibleTokenMetadata, FungibleTokenMetadataProvider, FT_METADATA_SPEC,
};
use near_contract_standards::fungible_token::resolver::FungibleTokenResolver;
use near_contract_standards::fungible_token::FungibleToken;
use near_contract_standards::storage_management::{
    StorageBalance, StorageBalanceBounds, StorageManagement,
};
use near_sdk::json_types::U128;
use near_sdk::{env, near, require, AccountId, NearToken, PanicOnDefault, PromiseOrValue};

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    owner: AccountId,
    token: FungibleToken,
    meta: FungibleTokenMetadata,
    /// e2e knob, like usdc's blacklist: transfers to this account fail
    blocked: Option<AccountId>,
}

#[near]
impl Contract {
    #[init]
    pub fn new(owner: AccountId, name: String, symbol: String, decimals: u8) -> Self {
        Self {
            owner,
            token: FungibleToken::new(b"t"),
            meta: FungibleTokenMetadata {
                spec: FT_METADATA_SPEC.to_string(),
                name,
                symbol,
                icon: None,
                reference: None,
                reference_hash: None,
                decimals,
            },
            blocked: None,
        }
    }

    pub fn mint(&mut self, to: AccountId, amount: U128) {
        require!(env::predecessor_account_id() == self.owner, "only owner");
        if !self.token.accounts.contains_key(&to) {
            self.token.internal_register_account(&to);
        }
        self.token.internal_deposit(&to, amount.0);
    }

    pub fn set_blocked(&mut self, account: Option<AccountId>) {
        require!(env::predecessor_account_id() == self.owner, "only owner");
        self.blocked = account;
    }
}

#[near]
impl FungibleTokenCore for Contract {
    #[payable]
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>) {
        require!(self.blocked.as_ref() != Some(&receiver_id), "receiver blocked");
        self.token.ft_transfer(receiver_id, amount, memo)
    }

    #[payable]
    fn ft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        amount: U128,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<U128> {
        self.token.ft_transfer_call(receiver_id, amount, memo, msg)
    }

    fn ft_total_supply(&self) -> U128 {
        self.token.ft_total_supply()
    }

    fn ft_balance_of(&self, account_id: AccountId) -> U128 {
        self.token.ft_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenResolver for Contract {
    #[private]
    fn ft_resolve_transfer(&mut self, sender_id: AccountId, receiver_id: AccountId, amount: U128) -> U128 {
        self.token.internal_ft_resolve_transfer(&sender_id, receiver_id, amount).0.into()
    }
}

#[near]
impl StorageManagement for Contract {
    #[payable]
    fn storage_deposit(&mut self, account_id: Option<AccountId>, registration_only: Option<bool>) -> StorageBalance {
        self.token.storage_deposit(account_id, registration_only)
    }

    #[payable]
    fn storage_withdraw(&mut self, amount: Option<NearToken>) -> StorageBalance {
        self.token.storage_withdraw(amount)
    }

    #[payable]
    fn storage_unregister(&mut self, force: Option<bool>) -> bool {
        self.token.internal_storage_unregister(force).is_some()
    }

    fn storage_balance_bounds(&self) -> StorageBalanceBounds {
        self.token.storage_balance_bounds()
    }

    fn storage_balance_of(&self, account_id: AccountId) -> Option<StorageBalance> {
        self.token.storage_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenMetadataProvider for Contract {
    fn ft_metadata(&self) -> FungibleTokenMetadata {
        self.meta.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    fn acc(s: &str) -> AccountId {
        s.parse().unwrap()
    }

    fn ctx(pred: &str, deposit: u128) {
        testing_env!(VMContextBuilder::new()
            .predecessor_account_id(acc(pred))
            .signer_account_id(acc(pred))
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .build());
    }

    fn token() -> Contract {
        ctx("owner", 0);
        Contract::new(acc("owner"), "Test USDC".into(), "tUSDC".into(), 6)
    }

    #[test]
    fn owner_mints() {
        let mut t = token();
        t.mint(acc("alice"), U128(5));
        assert_eq!(t.ft_balance_of(acc("alice")).0, 5);
        assert_eq!(t.ft_total_supply().0, 5);
        assert_eq!(t.ft_metadata().decimals, 6);
    }

    #[test]
    #[should_panic(expected = "only owner")]
    fn stranger_cannot_mint() {
        let mut t = token();
        ctx("mallory", 0);
        t.mint(acc("mallory"), U128(5));
    }

    #[test]
    fn transfer_moves_balance() {
        let mut t = token();
        t.mint(acc("alice"), U128(10));
        t.mint(acc("bob"), U128(0));
        ctx("alice", 1);
        t.ft_transfer(acc("bob"), U128(4), None);
        assert_eq!(t.ft_balance_of(acc("alice")).0, 6);
        assert_eq!(t.ft_balance_of(acc("bob")).0, 4);
    }

    #[test]
    fn transfer_call_refunds_unused() {
        let mut t = token();
        t.mint(acc("alice"), U128(10));
        t.mint(acc("vault"), U128(0));
        ctx("alice", 1);
        let _ = t.ft_transfer_call(acc("vault"), U128(10), None, String::new());
        assert_eq!(t.ft_balance_of(acc("vault")).0, 10);
        // receiver returned 7 unused → resolve sends 7 back
        testing_env!(
            VMContextBuilder::new().predecessor_account_id(acc("ft")).current_account_id(acc("ft")).build(),
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            Default::default(),
            vec![near_sdk::PromiseResult::Successful(near_sdk::serde_json::to_vec(&U128(7)).unwrap())]
        );
        assert_eq!(t.ft_resolve_transfer(acc("alice"), acc("vault"), U128(10)).0, 3);
        assert_eq!(t.ft_balance_of(acc("alice")).0, 7);
        assert_eq!(t.ft_balance_of(acc("vault")).0, 3);
    }
}
