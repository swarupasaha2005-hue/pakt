//! Review regressions: each hole the second review found, asserted closed.
use near_sdk::json_types::U128;
use near_sdk::serde_json::{json, to_vec};
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::{testing_env, AccountId, Gas, NearToken, PromiseResult, RuntimeFeesConfig};

use super::*;

const USD: u128 = 1_000_000;

fn acc(s: &str) -> AccountId {
    s.parse().unwrap()
}

fn ctx_gas(pred: &str, ms: u64, tgas: u64, results: Vec<PromiseResult>) {
    testing_env!(
        VMContextBuilder::new()
            .current_account_id(acc("vault"))
            .predecessor_account_id(acc(pred))
            .signer_account_id(acc(pred))
            .prepaid_gas(Gas::from_tgas(tgas))
            .attached_deposit(NearToken::from_yoctonear(0))
            .account_balance(NearToken::from_near(10))
            .block_timestamp(ms * 1_000_000)
            .build(),
        near_sdk::test_vm_config(),
        RuntimeFeesConfig::test(),
        Default::default(),
        results
    );
}

fn ctx_at(pred: &str, ms: u64, results: Vec<PromiseResult>) {
    ctx_gas(pred, ms, 300, results);
}

/// every token: 6 decimals at $1
fn tokens(n: usize) -> Vec<AccountId> {
    (0..n).map(|i| if i == 0 { acc("usdc") } else { acc(&format!("t{i}")) }).collect()
}

fn price_json(n: usize) -> near_sdk::serde_json::Value {
    let p: Vec<_> = tokens(n).iter().map(|t| json!({"asset_id": t, "price": {"multiplier": "10000", "decimals": 10}})).collect();
    json!({"timestamp": "1", "recency_duration_sec": 90, "prices": p})
}

fn prices(n: usize) -> PromiseResult {
    PromiseResult::Successful(to_vec(&price_json(n)).unwrap())
}

fn pdata(n: usize) -> oracle::PriceData {
    near_sdk::serde_json::from_value(price_json(n)).unwrap()
}

fn ok_u128(x: u128) -> PromiseResult {
    PromiseResult::Successful(to_vec(&U128(x)).unwrap())
}

fn vault(n: usize) -> Vault {
    ctx_at("factory", 1_000, vec![]);
    Vault::new(VaultConfig {
        dao: acc("dao"),
        oracle: acc("oracle"),
        base_token: acc("usdc"),
        whitelist: tokens(n),
        platform: acc("platform"),
        join_mode: JoinMode::Open,
        invite_key: None,
        min_deposit: U128(5 * USD),
        dao_bond: U128(100_000_000_000_000_000_000_000),
        dex: acc("ref"),
        settle_period_ms: 7 * DAY_MS,
        trade_delay_ms: MIN_TRADE_DELAY_MS,
    })
}

fn deposit(v: &mut Vault, who: &str, usd: u128, ms: u64, n: usize) {
    v.storage.insert(acc(who), storage::STORAGE_FEE.as_yoctonear());
    ctx_at("usdc", ms, vec![]);
    let _ = v.ft_on_transfer(acc(who), U128(usd * USD), String::new());
    ctx_at("vault", ms, vec![prices(n)]);
    assert_eq!(v.on_deposit(acc(who), U128(usd * USD), v.flow_gen).0, 0, "deposit refunded");
}

fn hire(v: &mut Vault, n: usize) {
    ctx_at("dao", 1_000, vec![]);
    v.offer_trader(acc("tt"), U128(500 * USD), U128(50 * USD), 2_000, 9_000);
    ctx_at("tt", 1_000, vec![]);
    v.accept_offer();
    ctx_at("vault", 1_000, vec![prices(n)]);
    v.on_accept(acc("tt"), v.op_id);
    v.trade_after_ms = 0;
}

fn panics(f: impl FnOnce()) -> String {
    let e = std::panic::catch_unwind(std::panic::AssertUnwindSafe(f)).expect_err("should panic");
    e.downcast_ref::<String>().cloned().or_else(|| e.downcast_ref::<&str>().map(|s| s.to_string())).unwrap_or_default()
}

/// M-A: a late callback from a flow dropped by `unlock` must not clear the next op's lock or pay out.
#[test]
fn late_callback_after_unlock_is_ignored() {
    let mut v = vault(2);
    deposit(&mut v, "aa", 100, 1_000, 2);
    deposit(&mut v, "bb", 100, 1_000, 2);
    hire(&mut v, 2);
    ctx_at("aa", 1_000, vec![]);
    v.leave(U128(100 * USD)); // on_leave receipt delayed past the TTL
    let old = v.flow_gen;
    let t = 1_000 + LOCK_TTL_MS;
    ctx_at("anyone", t, vec![]);
    v.unlock();
    ctx_at("tt", t, vec![]);
    v.trade(7, acc("usdc"), acc("t1"), U128(50 * USD), U128(0));
    ctx_at("vault", t, vec![prices(2)]);
    v.on_trade_prices(7, 0, 1, U128(50 * USD), U128(0), v.op_id);
    // the stale on_leave finally lands: nothing moves
    ctx_at("vault", t, vec![prices(2)]);
    v.on_leave(acc("aa"), U128(100 * USD), old);
    assert_eq!((v.op, v.balances[0], v.at_dex[0]), (Some(Op::Trade), 150 * USD, 50 * USD));
    assert_eq!(v.holders.get(&acc("aa")).unwrap().shares.0, 100 * USD);
    // stale exclusive callback is ignored too
    let id = v.op_id;
    ctx_at("vault", t, vec![ok_u128(0)]);
    v.on_dex_deposit(7, 0, 1, U128(50 * USD), U128(1), U128(50 * USD), pdata(2), id - 1);
    assert_eq!((v.op, v.at_dex[0]), (Some(Op::Trade), 50 * USD));
    ctx_at("tt", t, vec![]);
    assert!(panics(|| v.trade(7, acc("usdc"), acc("t1"), U128(10 * USD), U128(0))).contains("busy"));
}

/// M-B: on_swap died after Ref swapped. dex_recover resyncs at_dex from Ref's real deposits, then leave works.
#[test]
fn dead_on_swap_recovered_from_ref_deposits() {
    let mut v = vault(2);
    deposit(&mut v, "aa", 100, 1_000, 2);
    hire(&mut v, 2);
    ctx_at("tt", 1_000, vec![]);
    v.trade(7, acc("usdc"), acc("t1"), U128(50 * USD), U128(0));
    ctx_at("vault", 1_000, vec![prices(2)]);
    v.on_trade_prices(7, 0, 1, U128(50 * USD), U128(0), v.op_id);
    ctx_at("vault", 1_000, vec![ok_u128(50 * USD)]);
    v.on_dex_deposit(7, 0, 1, U128(50 * USD), U128(1), U128(50 * USD), pdata(2), v.op_id);
    // swap executed at Ref (usdc -> 49 t1), on_swap panicked
    let t = 1_000 + LOCK_TTL_MS;
    ctx_at("anyone", t, vec![]);
    v.unlock();
    let ref_deposits = || PromiseResult::Successful(to_vec(&json!({"usdc": "0", "t1": (49 * USD).to_string(), "junk": "5"})).unwrap());
    ctx_at("anyone", t, vec![]);
    v.dex_recover(acc("t1"));
    ctx_at("vault", t, vec![ref_deposits()]);
    v.on_dex_deposits(1, v.op_id);
    assert_eq!(v.at_dex, vec![0, 49 * USD]);
    ctx_at("vault", t, vec![ok_u128(49 * USD)]);
    v.on_dex_withdraw(1, U128(49 * USD), v.op_id);
    assert_eq!((v.balances.clone(), v.at_dex.clone(), v.op), (vec![50 * USD, 49 * USD], vec![0, 0], None));
    ctx_at("aa", t, vec![]);
    v.leave(U128(USD));
}

/// L-a: dao swaps the offer while accept's prices are in flight: nobody is hired.
#[test]
fn offer_swapped_during_accept_hires_nobody() {
    let mut v = vault(2);
    deposit(&mut v, "aa", 100, 1_000, 2);
    ctx_at("dao", 1_000, vec![]);
    v.offer_trader(acc("tt"), U128(500 * USD), U128(50 * USD), 2_000, 9_000);
    ctx_at("tt", 1_000, vec![]);
    v.accept_offer();
    ctx_at("dao", 1_000, vec![]);
    v.offer_trader(acc("mallory"), U128(500 * USD), U128(500 * USD), 3_000, 9_000);
    ctx_at("vault", 1_000, vec![prices(2)]);
    v.on_accept(acc("tt"), v.op_id);
    assert!(v.trader.is_none() && v.op.is_none());
    assert_eq!(v.offer.as_ref().unwrap().terms.account, acc("mallory"));
}

/// M-C: a deposit worth under $5 is refunded even when the raw amount passes min_deposit.
#[test]
fn deposit_under_5_usd_refunded() {
    let mut v = vault(2);
    v.storage.insert(acc("aa"), storage::STORAGE_FEE.as_yoctonear());
    ctx_at("usdc", 1_000, vec![]);
    let _ = v.ft_on_transfer(acc("aa"), U128(5 * USD), String::new());
    // usdc oracle at $0.99: 5 usdc = $4.95
    let p = json!({"timestamp": "1", "recency_duration_sec": 90, "prices": [
        {"asset_id": "usdc", "price": {"multiplier": "9900", "decimals": 10}},
        {"asset_id": "t1", "price": {"multiplier": "10000", "decimals": 10}}]});
    ctx_at("vault", 1_000, vec![PromiseResult::Successful(to_vec(&p).unwrap())]);
    assert_eq!(v.on_deposit(acc("aa"), U128(5 * USD), v.flow_gen).0, 5 * USD);
    assert!(near_sdk::test_utils::get_logs().iter().any(|l| l.contains("refund: below $5")));
    assert_eq!((v.total_shares, v.flows), (0, 0));
}
