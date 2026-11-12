//! Lock/flow redesign review PoCs. Mocked-VM gas counts only host costs (promises, storage, logs), not wasm,
//! so a measured number is a lower bound of real on-chain use.
use near_sdk::json_types::U128;
use near_sdk::serde_json::{json, to_vec};
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::{testing_env, AccountId, Gas, NearToken, PromiseResult, RuntimeFeesConfig};

use super::*;

const USD: u128 = 1_000_000;

fn acc(s: &str) -> AccountId {
    s.parse().unwrap()
}

fn ctx_full(pred: &str, ms: u64, tgas: u64, near: NearToken, results: Vec<PromiseResult>) {
    testing_env!(
        VMContextBuilder::new()
            .current_account_id(acc("vault"))
            .predecessor_account_id(acc(pred))
            .signer_account_id(acc(pred))
            .prepaid_gas(Gas::from_tgas(tgas))
            .account_balance(near)
            .block_timestamp(ms * 1_000_000)
            .build(),
        near_sdk::test_vm_config(),
        RuntimeFeesConfig::test(),
        Default::default(),
        results
    );
}

fn ctx_gas(pred: &str, ms: u64, tgas: u64, results: Vec<PromiseResult>) {
    ctx_full(pred, ms, tgas, NearToken::from_near(10), results);
}

fn ctx_at(pred: &str, ms: u64, results: Vec<PromiseResult>) {
    ctx_gas(pred, ms, 300, results);
}

fn tokens(n: usize) -> Vec<AccountId> {
    (0..n).map(|i| if i == 0 { acc("usdc") } else { acc(&format!("t{i}")) }).collect()
}

fn prices(n: usize) -> PromiseResult {
    let p: Vec<_> = tokens(n).iter().map(|t| json!({"asset_id": t, "price": {"multiplier": "10000", "decimals": 10}})).collect();
    PromiseResult::Successful(to_vec(&json!({"timestamp": "1", "recency_duration_sec": 90, "prices": p})).unwrap())
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
    assert_eq!(v.on_deposit(acc(who), U128(usd * USD), v.flow_gen).0, 0);
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

/// H1: a full member exit from a vault holding 7-8 tokens needs more than GAS_LEAVE_CB (230 Tgas) in host costs alone.
#[test]
fn full_leave_many_tokens_exceeds_callback_gas() {
    for n in [6usize, 7, 8] {
        let mut v = vault(n);
        deposit(&mut v, "aa", 100, 1_000, n);
        deposit(&mut v, "bb", 100, 1_000, n);
        for i in 1..n {
            v.balances[i] = 10 * USD;
        }
        ctx_at("aa", 2_000, vec![]);
        v.leave(U128(100 * USD));
        let gen = v.flow_gen;
        ctx_gas("vault", 2_000, 300, vec![prices(n)]);
        v.on_leave(acc("aa"), U128(100 * USD), gen);
        let used = env::used_gas().as_tgas();
        println!("on_leave full exit, {n} tokens: {used} Tgas host-side (budget {})", shares::GAS_LEAVE_CB.as_tgas());
        if n >= 7 {
            assert!(used > shares::GAS_LEAVE_CB.as_tgas(), "{n} tokens should overflow 230 Tgas, used {used}");
        }
    }
    // and at the real 230 Tgas budget the callback dies (on chain: reverts, flow stays counted)
    let mut v = vault(8);
    deposit(&mut v, "aa", 100, 1_000, 8);
    deposit(&mut v, "bb", 100, 1_000, 8);
    for i in 1..8 {
        v.balances[i] = 10 * USD;
    }
    ctx_at("aa", 2_000, vec![]);
    v.leave(U128(100 * USD));
    let gen = v.flow_gen;
    ctx_gas("vault", 2_000, shares::GAS_LEAVE_CB.as_tgas(), vec![prices(8)]);
    let msg = panics(|| v.on_leave(acc("aa"), U128(100 * USD), gen));
    println!("on_leave at 230 Tgas: {msg}");
}

/// Gas lower bounds of the other tight callbacks, for the report.
#[test]
fn measure_other_callbacks() {
    let mut v = vault(2);
    v.storage.insert(acc("aa"), storage::STORAGE_FEE.as_yoctonear());
    ctx_at("usdc", 1_000, vec![]);
    let _ = v.ft_on_transfer(acc("aa"), U128(100 * USD), String::new());
    ctx_gas("vault", 1_000, 300, vec![prices(2)]);
    v.on_deposit(acc("aa"), U128(100 * USD), v.flow_gen);
    println!("on_deposit new member: {} Tgas (static 100)", env::used_gas().as_tgas());
    ctx_gas("vault", 1_000, 300, vec![PromiseResult::Successful(to_vec(&7u64).unwrap())]);
    let _ = v.on_proposed(acc("aa"), true);
    println!("on_proposed: {} Tgas (static 40)", env::used_gas().as_tgas());
}

/// H2: one dead flow + any flow started every <10 min keeps `flows` > 0 forever: unlock refuses, every exclusive op is busy.
#[test]
fn dead_flow_kept_alive_by_fresh_flows() {
    let mut v = vault(2);
    deposit(&mut v, "aa", 100, 1_000, 2);
    deposit(&mut v, "bb", 100, 1_000, 2);
    ctx_at("aa", 1_000, vec![]);
    v.leave(U128(USD)); // its on_leave dies (e.g. out of gas): flows stuck at 1
    let mut t = 1_000;
    for _ in 0..6 {
        t += 9 * 60_000;
        ctx_at("bb", t, vec![]);
        v.leave(U128(1));
        let gen = v.flow_gen;
        ctx_at("vault", t, vec![prices(2)]);
        v.on_leave(acc("bb"), U128(1), gen);
    }
    // dead flow is 54 minutes old
    assert_eq!(v.flows, 1);
    ctx_at("anyone", t + 60_000, vec![]);
    assert!(panics(|| v.unlock()).contains("nothing stale"));
    ctx_at("dao", t + 60_000, vec![]);
    v.offer_trader(acc("tt"), U128(500 * USD), U128(50 * USD), 2_000, 9_000);
    ctx_at("tt", t + 60_000, vec![]);
    assert!(panics(|| v.accept_offer()).contains("busy"));
}

/// M1: dao fire on an idle vault does not pause; if on_fire dies, unlock hands the trader back full trading rights.
#[test]
fn unlocked_fire_leaves_trader_live() {
    let mut v = vault(2);
    deposit(&mut v, "aa", 100, 1_000, 2);
    hire(&mut v, 2);
    ctx_at("dao", 2_000, vec![]);
    v.fire();
    assert!(!v.trader.as_ref().unwrap().paused && !v.fire_pending);
    // on_fire never lands
    ctx_at("anyone", 2_000 + LOCK_TTL_MS, vec![]);
    v.unlock();
    ctx_at("tt", 2_000 + LOCK_TTL_MS, vec![]);
    v.trade(7, acc("usdc"), acc("t1"), U128(50 * USD), U128(0));
    assert_eq!(v.op, Some(Op::Trade));
    assert!(panics(|| v.finish_fire()).contains("no fire pending"));
}

/// M1b: the idle fire path needs 250 Tgas from the dao proposal; the busy path needs none.
#[test]
fn fire_idle_path_needs_250_tgas() {
    let mut v = vault(2);
    deposit(&mut v, "aa", 100, 1_000, 2);
    hire(&mut v, 2);
    ctx_gas("dao", 2_000, 150, vec![]);
    assert!(panics(|| v.fire()).contains("attach at least"));
}

/// L: last holder's failed payout with no free NEAR goes back to the pool at total_shares 0; next depositor takes it.
#[test]
fn orphan_payout_windfall_to_next_depositor() {
    let mut v = vault(2);
    deposit(&mut v, "aa", 100, 1_000, 2);
    ctx_at("aa", 1_000, vec![]);
    v.leave(U128(100 * USD));
    let gen = v.flow_gen;
    ctx_at("vault", 1_000, vec![prices(2)]);
    v.on_leave(acc("aa"), U128(100 * USD), gen);
    assert_eq!(v.total_shares, 0);
    ctx_full("vault", 1_000, 300, NearToken::from_yoctonear(0), vec![PromiseResult::Failed]);
    v.on_payout(acc("aa"), acc("usdc"), U128(100 * USD));
    assert_eq!((v.balances[0], v.total_shares), (100 * USD, 0));
    deposit(&mut v, "bb", 10, 2_000, 2);
    // bb owns 100% of 110 usdc for a 10 usdc deposit
    assert_eq!(v.total_shares, v.holders.get(&acc("bb")).unwrap().shares.0);
    assert_eq!(v.balances[0], 110 * USD);
}

/// L: the slippage window is fixed, not rolling: the full 3% budget twice within a minute.
#[test]
fn slip_window_tumbles() {
    let mut v = vault(2);
    deposit(&mut v, "aa", 1_000, 1_000, 2);
    hire(&mut v, 2);
    let total = 1_000 * USD;
    let cap = total * trade::MAX_PERIOD_SLIP_BPS / BPS;
    v.slip_used = cap; // budget spent just before the window ends
    let t = v.slip_since_ms + DAY_MS;
    ctx_at("tt", t, vec![]);
    v.trade(7, acc("usdc"), acc("t1"), U128(50 * USD), U128(0));
    ctx_at("vault", t, vec![prices(2)]);
    v.on_trade_prices(7, 0, 1, U128(50 * USD), U128(0), v.op_id);
    assert_eq!((v.slip_used, v.op), (0, Some(Op::Trade)), "budget fully reset one ms after a full spend");
}
