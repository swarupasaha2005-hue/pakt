use near_sdk::json_types::U128;
use near_sdk::test_utils::{get_logs, VMContextBuilder};
use near_sdk::{testing_env, AccountId, NearToken, PromiseResult, RuntimeFeesConfig};

use crate::{Config, Factory, JoinMode};

fn acc(s: &str) -> AccountId {
    s.parse().unwrap()
}

fn ctx(pred: &str, deposit: NearToken) -> VMContextBuilder {
    let mut b = VMContextBuilder::new();
    b.current_account_id(acc("pakt.testnet"))
        .predecessor_account_id(acc(pred))
        .attached_deposit(deposit)
        .account_balance(NearToken::from_near(100));
    b
}

fn with_results(results: Vec<PromiseResult>) {
    testing_env!(
        ctx("pakt.testnet", NearToken::from_yoctonear(0)).build(),
        near_sdk::test_vm_config(),
        RuntimeFeesConfig::test(),
        Default::default(),
        results
    );
}

fn setup() -> Factory {
    testing_env!(ctx("admin.testnet", NearToken::from_yoctonear(0)).build());
    Factory::new(
        Config {
            oracle: acc("oracle.testnet"),
            platform: acc("platform.testnet"),
            sputnik_factory: acc("sputnikv2.testnet"),
            dao_bond: U128(100),
            tokens: vec![acc("usdc.testnet"), acc("btc.testnet")],
            base_tokens: vec![acc("usdc.testnet")],
            dex: acc("ref-finance-101.testnet"),
            settle_period_ms: 7 * 86_400_000,
            trade_delay_ms: 3_600_000,
        },
        acc("admin.testnet"),
    )
}

fn create(f: &mut Factory, name: &str, deposit: NearToken) {
    testing_env!(ctx("alice.testnet", deposit).build());
    let _ = f.create_pakt(name.into(), vec![acc("usdc.testnet"), acc("btc.testnet")], 2500, JoinMode::Open, None, U128(5_000_000));
}

fn need(f: &Factory) -> NearToken {
    f.required_deposit(2)
}

#[test]
fn registry_records_and_lists() {
    let mut f = setup();
    let d = need(&f);
    create(&mut f, "moon", d);
    create(&mut f, "sun", d);
    let p = f.get_pakt("moon".into()).unwrap();
    assert_eq!(p.vault.as_str(), "moon.pakt.testnet");
    assert_eq!(p.dao.as_str(), "moon.sputnikv2.testnet");
    assert_eq!(p.creator.as_str(), "alice.testnet");
    assert_eq!(f.list_pakts(None, None).len(), 2);
    assert_eq!(f.list_pakts(Some(1), Some(5))[0].name, "sun");
}

#[test]
#[should_panic(expected = "name taken")]
fn rejects_duplicate() {
    let mut f = setup();
    let d = need(&f);
    create(&mut f, "moon", d);
    create(&mut f, "moon", d);
}

#[test]
#[should_panic(expected = "name: 2-32")]
fn rejects_invalid_name() {
    let mut f = setup();
    let d = need(&f);
    create(&mut f, "Moon.x", d);
}

#[test]
#[should_panic(expected = "attach at least")]
fn rejects_low_deposit() {
    let mut f = setup();
    let d = need(&f).saturating_sub(NearToken::from_yoctonear(1));
    create(&mut f, "moon", d);
}

#[test]
#[should_panic(expected = "invite mode needs")]
fn invite_needs_key() {
    let mut f = setup();
    testing_env!(ctx("alice.testnet", need(&f)).build());
    let _ = f.create_pakt("moon".into(), vec![acc("usdc.testnet")], 2500, JoinMode::Invite, Some("ab".into()), U128(1));
}

#[test]
#[should_panic(expected = "token not allowed")]
fn rejects_unlisted_token() {
    let mut f = setup();
    testing_env!(ctx("alice.testnet", need(&f)).build());
    let _ = f.create_pakt("moon".into(), vec![acc("usdc.testnet"), acc("scam.testnet")], 0, JoinMode::Open, None, U128(1));
}

#[test]
#[should_panic(expected = "allowed base token")]
fn rejects_non_base_first() {
    let mut f = setup();
    testing_env!(ctx("alice.testnet", need(&f)).build());
    let _ = f.create_pakt("moon".into(), vec![acc("btc.testnet")], 0, JoinMode::Open, None, U128(1));
}

#[test]
fn deposit_covers_code_dao_and_regs() {
    let f = setup();
    let code = near_sdk::env::storage_byte_cost().saturating_mul(crate::VAULT_WASM.len() as u128);
    let floor = code.saturating_add(crate::VAULT_BUFFER).saturating_add(crate::DAO_DEPOSIT).saturating_add(crate::DEX_STORAGE);
    assert!(f.required_deposit(0) > floor);
    assert_eq!(f.required_deposit(2).saturating_sub(f.required_deposit(0)), crate::FT_REG.saturating_mul(2));
}

#[test]
fn failed_dao_frees_name() {
    let mut f = setup();
    let d = need(&f);
    create(&mut f, "moon", d);
    with_results(vec![PromiseResult::Failed]);
    let out = f.on_dao_check("moon".into(), acc("alice.testnet"), d, vec![1].into(), "{}".into(), vec![], JoinMode::Open);
    assert!(matches!(out, near_sdk::PromiseOrValue::Value(false)));
    assert!(f.get_pakt("moon".into()).is_none());
}

#[test]
fn squatted_dao_is_rejected() {
    let mut f = setup();
    let d = need(&f);
    create(&mut f, "moon", d);
    with_results(vec![PromiseResult::Successful(br#"{"name":"moon","purpose":"","metadata":"AA=="}"#.to_vec())]);
    let out = f.on_dao_check("moon".into(), acc("alice.testnet"), d, vec![1].into(), "{}".into(), vec![], JoinMode::Open);
    assert!(matches!(out, near_sdk::PromiseOrValue::Value(false)));
    assert!(f.get_pakt("moon".into()).is_none());
}

#[test]
fn failed_vault_frees_name_and_success_emits() {
    let mut f = setup();
    let d = need(&f);
    create(&mut f, "moon", d);
    create(&mut f, "sun", d);
    with_results(vec![PromiseResult::Failed]);
    assert!(!f.on_create("moon".into(), acc("alice.testnet"), d, JoinMode::Open));
    assert!(f.get_pakt("moon".into()).is_none());
    with_results(vec![PromiseResult::Successful(vec![])]);
    assert!(f.on_create("sun".into(), acc("alice.testnet"), d, JoinMode::Open));
    assert_eq!(
        get_logs()[0],
        r#"EVENT_JSON:{"standard":"pakt","version":"1.0.0","event":"pakt_created","data":[{"name":"sun","vault":"sun.pakt.testnet","dao":"sun.sputnikv2.testnet","creator":"alice.testnet","join_mode":"Open"}]}"#
    );
}

#[test]
#[should_panic(expected = "only owner")]
fn config_only_owner() {
    let mut f = setup();
    testing_env!(ctx("mallory.testnet", NearToken::from_yoctonear(0)).build());
    let c = f.get_config().clone();
    f.set_config(c);
}

#[test]
#[should_panic(expected = "settle_period_ms >= 60000")]
fn settle_period_floor() {
    let mut f = setup();
    testing_env!(ctx("admin.testnet", NearToken::from_yoctonear(0)).build());
    let mut c = f.get_config().clone();
    c.settle_period_ms = 59_999;
    f.set_config(c);
}


#[test]
#[should_panic(expected = "trade_delay_ms >= 60000")]
fn trade_delay_floor() {
    let mut f = setup();
    testing_env!(ctx("admin.testnet", NearToken::from_yoctonear(0)).build());
    let mut c = f.get_config().clone();
    c.trade_delay_ms = 59_999;
    f.set_config(c);
}

#[test]
#[should_panic(expected = "min_deposit > 0")]
fn rejects_zero_min_deposit() {
    let mut f = setup();
    testing_env!(ctx("alice.testnet", need(&f)).build());
    let _ = f.create_pakt("moon".into(), vec![acc("usdc.testnet")], 2500, JoinMode::Open, None, U128(0));
}

#[test]
#[should_panic(expected = "stop_loss_bps: 100-9000")]
fn stop_loss_in_vault_range() {
    let mut f = setup();
    testing_env!(ctx("alice.testnet", need(&f)).build());
    let _ = f.create_pakt("moon".into(), vec![acc("usdc.testnet")], 9_500, JoinMode::Open, None, U128(1));
}
