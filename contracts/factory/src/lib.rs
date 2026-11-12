//! pakt factory: creates the `<name>.<factory>` vault + `<name>.<sputnik>` dao, keeps the registry.
use near_sdk::json_types::{Base64VecU8, U128};
use near_sdk::serde_json::{self, json, Value};
use near_sdk::store::IterableMap;
use near_sdk::{
    env, near, require, AccountId, Gas, GasWeight, NearToken, PanicOnDefault, Promise, PromiseOrValue,
};

mod name;
mod policy;

const VAULT_WASM: &[u8] = include_bytes!("../../res/pakt_vault.wasm");
/// owner override from `set_vault_code`; new pakts only, live vaults have no keys
const CODE_KEY: &[u8] = b"code";
/// ~100 holders + events + owed ~ 1 NEAR storage; rest floats dao bonds in flight
const VAULT_BUFFER: NearToken = NearToken::from_near(3);
/// sputnik deploys its ~540KB dao code per dao (5.4 NEAR storage, seen on testnet)
const DAO_DEPOSIT: NearToken = NearToken::from_near(6);
/// vault registers itself on each token from this; same as vault trade::FT_REG
const FT_REG: NearToken = NearToken::from_micronear(1250);
/// vault init pays ref storage from this; same as vault trade::DEX_STORAGE
const DEX_STORAGE: NearToken = NearToken::from_millinear(50);
const MIN_SETTLE_PERIOD_MS: u64 = 60_000;
/// same as vault MIN_TRADE_DELAY_MS
const MIN_TRADE_DELAY_MS: u64 = 60_000;
/// registry row stays on the factory
const ROW_BYTES: u128 = 500;
const MAX_TOKENS: usize = 8;

/// sputnik create gets this plus all unused gas
const GAS_DAO: Gas = Gas::from_tgas(100);
/// on_dao and every hop after it
const GAS_CHAIN: Gas = Gas::from_tgas(155);
const GAS_VIEW: Gas = Gas::from_tgas(5);
/// deploy prepays ~71 Mgas per wasm byte (~30 Tgas at 426KB); `new` takes what is left by weight
const GAS_CHECK: Gas = Gas::from_tgas(145);
/// init + its ref batch (20) + one 3 Tgas self-registration per token (GAS_INIT_TOKEN)
const GAS_INIT: Gas = Gas::from_tgas(35);
const GAS_INIT_TOKEN: Gas = Gas::from_tgas(4);
const GAS_CB: Gas = Gas::from_tgas(10);

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Config {
    pub oracle: AccountId,
    pub platform: AccountId,
    /// sputnikv2.testnet / sputnik-dao.near
    pub sputnik_factory: AccountId,
    pub dao_bond: U128,
    /// tokens a pakt may hold; stops creators whitelisting fake tokens members can't vet
    pub tokens: Vec<AccountId>,
    /// allowed base (deposit) tokens, e.g. usdc
    pub base_tokens: Vec<AccountId>,
    /// ref exchange (rhea): v2.ref-finance.near / ref-finance-101.testnet
    pub dex: AccountId,
    /// min gap between settles: 7d mainnet, minutes on the testnet demo
    pub settle_period_ms: u64,
    /// hired trader waits this long before trading (and after a cap raise), so members can leave
    pub trade_delay_ms: u64,
}

#[near(serializers = [json])]
#[derive(Clone, Copy, PartialEq)]
pub enum JoinMode {
    Open,
    Invite,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Pakt {
    pub name: String,
    pub vault: AccountId,
    pub dao: AccountId,
    pub creator: AccountId,
    pub created_ms: u64,
    /// vault has no stop-loss at init; ui pre-fills the first trader offer with it (vault range)
    pub stop_loss_bps: u16,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Factory {
    owner: AccountId,
    config: Config,
    pakts: IterableMap<String, Pakt>,
}

#[near]
impl Factory {
    #[init]
    pub fn new(config: Config, owner: AccountId) -> Self {
        check_config(&config);
        Self {
            owner,
            config,
            pakts: IterableMap::new(b"p"),
        }
    }

    pub fn set_config(&mut self, config: Config) {
        self.only_owner();
        check_config(&config);
        self.config = config;
    }

    /// Raw wasm as the call args, no json.
    pub fn set_vault_code(&mut self) {
        self.only_owner();
        env::storage_write(CODE_KEY, &env::input().unwrap_or_default());
    }

    /// Attach `required_deposit(whitelist.len())` and 300 TGas; excess is refunded.
    #[payable]
    pub fn create_pakt(
        &mut self,
        name: String,
        whitelist: Vec<AccountId>,
        stop_loss_bps: u16,
        join_mode: JoinMode,
        invite_key: Option<String>,
        min_deposit: U128,
    ) -> Promise {
        let c = &self.config;
        let (vault, dao) = name::ids(&name, &env::current_account_id(), &c.sputnik_factory);
        require!(!self.pakts.contains_key(&name), "name taken");
        // vault init must not fail once the dao exists, so check its rules here
        require!((1..=MAX_TOKENS).contains(&whitelist.len()), "whitelist: 1-8 tokens");
        let mut seen = whitelist.clone();
        seen.sort();
        seen.dedup();
        require!(seen.len() == whitelist.len(), "duplicate token");
        require!(c.base_tokens.contains(&whitelist[0]), "whitelist[0] must be an allowed base token");
        require!(whitelist.iter().all(|t| c.tokens.contains(t)), "token not allowed");
        require!((100..=9_000).contains(&stop_loss_bps), "stop_loss_bps: 100-9000");
        require!(min_deposit.0 > 0, "min_deposit > 0");
        let key_ok = invite_key.as_ref().is_some_and(|k| k.len() == 64 && k.bytes().all(|b| b.is_ascii_hexdigit()));
        require!(join_mode == JoinMode::Open || key_ok, "invite mode needs 64-hex invite_key");
        let need = self.required(whitelist.len());
        let deposit = env::attached_deposit();
        require!(deposit >= need, format!("attach at least {need}"));
        let payer = env::predecessor_account_id();
        if let Some(excess) = deposit.checked_sub(need).filter(|e| !e.is_zero()) {
            Promise::new(payer.clone()).transfer(excess).detach();
        }

        let init = json!({"config": {
            "dao": dao,
            "oracle": c.oracle,
            "base_token": whitelist[0],
            "whitelist": whitelist,
            "platform": c.platform,
            "join_mode": join_mode,
            "invite_key": invite_key,
            "min_deposit": min_deposit,
            "dao_bond": c.dao_bond,
            "dex": c.dex,
            "settle_period_ms": c.settle_period_ms,
            "trade_delay_ms": c.trade_delay_ms,
        }})
        .to_string();
        let nonce: Base64VecU8 = env::random_seed()[..16].to_vec().into();
        let dao_args = policy::dao_args(&name, &vault, c.dao_bond, &nonce).to_string().into_bytes();
        let create = Promise::new(c.sputnik_factory.clone()).function_call_weight(
            "create",
            json!({"name": name, "args": Base64VecU8::from(dao_args)}).to_string(),
            DAO_DEPOSIT,
            GAS_DAO,
            GasWeight(1),
        );
        self.pakts.insert(
            name.clone(),
            Pakt { name: name.clone(), vault, dao, creator: payer.clone(), created_ms: env::block_timestamp_ms(), stop_loss_bps },
        );
        create.then(
            Self::ext(env::current_account_id())
                .with_static_gas(GAS_CHAIN)
                .with_unused_gas_weight(0)
                .on_dao(name, payer, need, nonce, init, whitelist, join_mode),
        )
    }

    /// Sputnik `create` resolves before its dao exists; one more hop lets that receipt land first.
    #[private]
    #[allow(clippy::too_many_arguments)]
    pub fn on_dao(
        &mut self,
        name: String,
        payer: AccountId,
        need: NearToken,
        nonce: Base64VecU8,
        init: String,
        whitelist: Vec<AccountId>,
        join_mode: JoinMode,
    ) -> Promise {
        let dao = self.pakts.get(&name).expect("pakt").dao.clone();
        Promise::new(dao).function_call("get_config", "{}", NearToken::from_yoctonear(0), GAS_VIEW).then(
            Self::ext(env::current_account_id())
                .with_static_gas(GAS_CHECK)
                .with_unused_gas_weight(0)
                .on_dao_check(name, payer, need, nonce, init, whitelist, join_mode),
        )
    }

    /// Dao must carry our nonce: a squatted `<name>.<sputnik>` fails create but still answers.
    /// Dao failed => nothing built yet, sputnik refunds us, so refund the payer in full.
    #[private]
    #[allow(clippy::too_many_arguments)]
    pub fn on_dao_check(
        &mut self,
        name: String,
        payer: AccountId,
        need: NearToken,
        nonce: Base64VecU8,
        init: String,
        whitelist: Vec<AccountId>,
        join_mode: JoinMode,
    ) -> PromiseOrValue<bool> {
        let ours = env::promise_result_checked(0, 4096)
            .ok()
            .and_then(|b| serde_json::from_slice::<Value>(&b).ok())
            .is_some_and(|c| c["metadata"] == json!(nonce));
        if !ours {
            return PromiseOrValue::Value(self.fail(name, payer, need));
        }
        let vault = self.pakts.get(&name).expect("pakt").vault.clone();
        let code = env::storage_read(CODE_KEY).unwrap_or_else(|| VAULT_WASM.to_vec());
        // vault keeps the FT_REG part: its init registers itself on every token
        let vault_cost = need.saturating_sub(DAO_DEPOSIT).saturating_sub(row());
        let init_gas = GAS_INIT.saturating_add(GAS_INIT_TOKEN.saturating_mul(whitelist.len() as u64));
        // one batch: nobody can init first; no access keys, so vault code is fixed
        Promise::new(vault.clone())
            .create_account()
            .transfer(vault_cost)
            .deploy_contract(code)
            .function_call_weight("new", init.into_bytes(), NearToken::from_yoctonear(0), init_gas, GasWeight(1))
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_CB).on_create(name, payer, vault_cost, join_mode))
            .into()
    }

    /// Vault failed after dao made: dao is orphaned (its 6 NEAR stays there), payer gets the vault part back.
    #[private]
    pub fn on_create(&mut self, name: String, payer: AccountId, vault_cost: NearToken, join_mode: JoinMode) -> bool {
        if env::promise_result_checked(0, 0).is_err() {
            return self.fail(name, payer, vault_cost);
        }
        let p = self.pakts.get(&name).expect("pakt");
        let data = json!({"name": p.name, "vault": p.vault, "dao": p.dao, "creator": p.creator, "join_mode": join_mode});
        env::log_str(&format!(
            "EVENT_JSON:{}",
            json!({"standard": "pakt", "version": "1.0.0", "event": "pakt_created", "data": [data]})
        ));
        true
    }

    pub fn required_deposit(&self, whitelist_len: u32) -> NearToken {
        self.required(whitelist_len as usize)
    }

    pub fn get_config(&self) -> &Config {
        &self.config
    }

    /// Includes in-flight pakts; they vanish again if creation fails.
    pub fn list_pakts(&self, from: Option<u32>, limit: Option<u32>) -> Vec<&Pakt> {
        self.pakts.values().skip(from.unwrap_or(0) as usize).take(limit.unwrap_or(50) as usize).collect()
    }

    pub fn get_pakt(&self, name: String) -> Option<&Pakt> {
        self.pakts.get(&name)
    }
}

impl Factory {
    fn only_owner(&self) {
        require!(env::predecessor_account_id() == self.owner, "only owner");
    }

    fn required(&self, tokens: usize) -> NearToken {
        let code = env::storage_read(CODE_KEY).map_or(VAULT_WASM.len(), |c| c.len()) as u128;
        env::storage_byte_cost()
            .saturating_mul(code)
            .saturating_add(VAULT_BUFFER)
            .saturating_add(DAO_DEPOSIT)
            .saturating_add(DEX_STORAGE)
            .saturating_add(regs_and_row(tokens))
    }

    fn fail(&mut self, name: String, payer: AccountId, refund: NearToken) -> bool {
        self.pakts.remove(&name);
        Promise::new(payer).transfer(refund).detach();
        false
    }
}

fn check_config(c: &Config) {
    require!(c.settle_period_ms >= MIN_SETTLE_PERIOD_MS, "settle_period_ms >= 60000");
    require!(c.trade_delay_ms >= MIN_TRADE_DELAY_MS, "trade_delay_ms >= 60000");
}

fn regs_and_row(tokens: usize) -> NearToken {
    FT_REG.saturating_mul(tokens as u128).saturating_add(row())
}

fn row() -> NearToken {
    env::storage_byte_cost().saturating_mul(ROW_BYTES)
}

#[cfg(test)]
mod tests;
