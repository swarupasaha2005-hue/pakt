//! Lock/flow redesign review PoCs. Mocked-VM gas counts only host costs (promises, storage, logs), not wasm,
//! so a measured number is a lower bound of real on-chain use.
use near_sdk::json_types::U128;
use near_sdk::serde_json::{json, to_vec};
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::{testing_env, AccountId, Gas, NearToken, PromiseOrValue, PromiseResult, RuntimeFeesConfig};

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

fn ctx_h(pred: &str, ms: u64, height: u64, results: Vec<PromiseResult>) {
    testing_env!(
        VMContextBuilder::new()
            .current_account_id(acc("vault"))
            .predecessor_account_id(acc(pred))
            .prepaid_gas(Gas::from_tgas(300))
            .account_balance(NearToken::from_near(10))
            .block_timestamp(ms * 1_000_000)
            .block_height(height)
            .build(),
        near_sdk::test_vm_config(),
        RuntimeFeesConfig::test(),
        Default::default(),
        results
    );
}

fn ok_u128(x: u128) -> PromiseResult {
    PromiseResult::Successful(to_vec(&U128(x)).unwrap())
}

fn deps(pairs: &[(&str, u128)]) -> PromiseResult {
    let m: std::collections::HashMap<_, _> = pairs.iter().map(|(t, a)| (t.to_string(), U128(*a))).collect();
    PromiseResult::Successful(to_vec(&m).unwrap())
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

/// Gas measurement only. The mock charges the pre-protocol-66 function-call fee (2.32+2.32 Tgas vs 0.2+0.78 on
/// mainnet) and 3x host costs, so it overstates; static gas of the spawned promises is exact. Not a proof of OOG.
#[test]
fn full_leave_gas_by_token_count() {
    for n in [4usize, 6] {
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
        println!("on_leave full exit, {n} tokens: {} Tgas in mock (budget {})", env::used_gas().as_tgas(), shares::GAS_LEAVE_CB.as_tgas());
    }
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

/// H1 (was dead_flow_kept_alive_by_fresh_flows): fresh flows no longer refresh `flow_since_ms`, so the dead one goes stale.
/// A refused exclusive op drains: no new flows, and after 0 flows deposits wait out the grace so it can run.
#[test]
fn dead_flow_goes_stale_despite_fresh_flows() {
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
    assert_eq!((v.flows, v.flow_since_ms), (1, 1_000));
    ctx_at("dao", t, vec![]);
    v.offer_trader(acc("tt"), U128(500 * USD), U128(50 * USD), 2_000, 9_000);
    // refused accept sets the drain: deposits refund, leaves wait
    ctx_at("tt", t, vec![]);
    v.accept_offer();
    assert!(v.op.is_none() && v.draining);
    v.storage.insert(acc("cc"), storage::STORAGE_FEE.as_yoctonear());
    ctx_at("usdc", t, vec![]);
    assert!(matches!(v.ft_on_transfer(acc("cc"), U128(10 * USD), String::new()), PromiseOrValue::Value(_)));
    assert!(near_sdk::test_utils::get_logs().iter().any(|l| l.contains("refund: draining, retry")));
    ctx_at("bb", t, vec![]);
    assert!(panics(|| v.leave(U128(1))).contains("draining"));
    // dead flow is 54 minutes old: stale
    ctx_at("anyone", t + 60_000, vec![]);
    v.unlock();
    assert_eq!(v.flows, 0);
    // flows at 0 but inside the grace: a deposit spammer can't jump ahead of the accept
    ctx_at("usdc", t + 60_000, vec![]);
    assert!(matches!(v.ft_on_transfer(acc("cc"), U128(10 * USD), String::new()), PromiseOrValue::Value(_)));
    ctx_at("tt", t + 60_000, vec![]);
    v.accept_offer();
    assert_eq!((v.op, v.draining), (Some(Op::Accept), false));
    ctx_at("vault", t + 60_000, vec![prices(2)]);
    v.on_accept(acc("tt"), v.op_id);
    deposit(&mut v, "cc", 10, t + 60_000, 2);
}

/// H1 grief check: a drain nobody follows up lapses after DRAIN_GRACE_MS.
#[test]
fn unused_drain_lapses() {
    let mut v = vault(2);
    deposit(&mut v, "aa", 100, 1_000, 2);
    hire(&mut v, 2);
    v.at_dex[1] = 1;
    ctx_at("aa", 1_000, vec![]);
    v.leave(U128(USD));
    ctx_at("anyone", 1_000, vec![]);
    v.dex_recover(acc("t1")); // anyone may set the drain
    assert!(v.draining);
    ctx_at("vault", 2_000, vec![prices(2)]);
    v.on_leave(acc("aa"), U128(USD), v.flow_gen);
    ctx_at("aa", 2_000 + DRAIN_GRACE_MS - 1, vec![]);
    assert!(panics(|| v.leave(U128(USD))).contains("draining"));
    ctx_at("aa", 2_000 + DRAIN_GRACE_MS, vec![]);
    v.leave(U128(USD));
    assert_eq!((v.flows, v.draining), (1, false));
}

/// M1 (was unlocked_fire_leaves_trader_live): idle fire pauses first, so a lost on_fire is finished by anyone.
#[test]
fn unlocked_fire_stays_paused_then_finishes() {
    let mut v = vault(2);
    deposit(&mut v, "aa", 100, 1_000, 2);
    hire(&mut v, 2);
    ctx_at("dao", 2_000, vec![]);
    v.fire();
    assert!(v.trader.as_ref().unwrap().paused && v.fire_pending && v.op == Some(Op::Fire));
    // on_fire never lands
    ctx_at("anyone", 2_000 + LOCK_TTL_MS, vec![]);
    v.unlock();
    ctx_at("tt", 2_000 + LOCK_TTL_MS, vec![]);
    assert!(panics(|| v.trade(7, acc("usdc"), acc("t1"), U128(50 * USD), U128(0))).contains("trader paused"));
    ctx_at("anyone", 2_000 + LOCK_TTL_MS, vec![]);
    v.finish_fire();
    ctx_at("vault", 2_000 + LOCK_TTL_MS, vec![prices(2)]);
    v.on_fire(v.op_id);
    assert!(v.trader.is_none() && !v.fire_pending && v.op.is_none());
}

/// M1b (was fire_idle_path_needs_250_tgas): a dao proposal under 250 Tgas pauses + defers, never fails.
#[test]
fn fire_short_gas_defers_to_finish_fire() {
    let mut v = vault(2);
    deposit(&mut v, "aa", 100, 1_000, 2);
    hire(&mut v, 2);
    ctx_gas("dao", 2_000, 150, vec![]);
    v.fire();
    assert!(v.trader.as_ref().unwrap().paused && v.fire_pending && v.op.is_none());
    assert!(near_sdk::test_utils::get_logs().iter().any(|l| l.contains(r#""event":"fire_pending""#)));
    ctx_at("anyone", 2_000, vec![]);
    v.finish_fire();
    assert_eq!(v.op, Some(Op::Fire));
}

/// L1 (was orphan_payout_windfall_to_next_depositor): the orphaned pool goes to the platform as shares.
#[test]
fn orphan_pool_minted_to_platform() {
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
    assert_eq!((v.balances[0], v.total_shares, v.out[0]), (100 * USD, 0, 0));
    deposit(&mut v, "bb", 10, 2_000, 2);
    // bb owns its own 10 of the 110, platform the orphaned 100
    let bb = v.holders.get(&acc("bb")).unwrap().shares.0;
    assert_eq!(math::mul_div(110 * USD, bb, v.total_shares), 10 * USD);
    assert_eq!(v.holders.get(&acc("platform")).unwrap().shares.0, 100 * USD);
}

/// L2 (was slip_window_tumbles): leaky bucket, no reset: a full spend leaves ~nothing a minute later, half after 12h.
#[test]
fn slip_budget_refills_linearly() {
    let mut v = vault(2);
    deposit(&mut v, "aa", 1_000, 1_000, 2);
    hire(&mut v, 2);
    // bucket = half the 24h budget: $15 of $1000; it refills $15/day, so any 24h span spends at most 3%
    let bucket = 1_000 * USD * trade::MAX_PERIOD_SLIP_BPS / BPS / 2;
    let t0 = v.slip_since_ms + DAY_MS;
    (v.slip_used, v.slip_since_ms) = (bucket, t0);
    ctx_at("tt", t0 + 60_000, vec![]);
    v.trade(7, acc("usdc"), acc("t1"), U128(50 * USD), U128(0));
    ctx_at("vault", t0 + 60_000, vec![prices(2)]);
    v.on_trade_prices(7, 0, 1, U128(50 * USD), U128(0), v.op_id);
    assert_eq!(v.op, None, "a minute after a full spend: refused");
    assert_eq!(v.slip_used, bucket - bucket * 60_000 / DAY_MS as u128);
    let t = t0 + DAY_MS / 2;
    ctx_at("tt", t, vec![]);
    v.trade(7, acc("usdc"), acc("t1"), U128(50 * USD), U128(0));
    ctx_at("vault", t, vec![prices(2)]);
    v.on_trade_prices(7, 0, 1, U128(50 * USD), U128(0), v.op_id);
    assert!(v.op == Some(Op::Trade) && v.slip_used.abs_diff(bucket / 2) <= 1, "half refilled after 12h");
}

/// M2: resync parks Ref's shortfall in suspense; reconcile credits only what the token proves is home.
#[test]
fn resync_shortfall_reconciled_up_to_onchain() {
    let mut v = vault(2);
    deposit(&mut v, "aa", 100, 1_000, 2);
    // a dead withdraw: 50 t1 came home but at_dex still says 50
    v.at_dex[1] = 50 * USD;
    ctx_at("anyone", 1_000, vec![]);
    v.dex_recover(acc("t1"));
    ctx_at("vault", 1_000, vec![deps(&[])]);
    v.on_dex_deposits(1, v.op_id);
    assert_eq!((v.at_dex[1], v.suspense[1], v.op), (0, 50 * USD, None));
    ctx_h("anyone", 1_000, 100, vec![]);
    v.reconcile(acc("t1"));
    // a refund raced the read: nothing credited
    v.inbound_block = 98;
    ctx_h("vault", 1_000, 101, vec![ok_u128(50 * USD)]);
    v.on_reconcile(1, 100, v.op_id);
    assert_eq!((v.balances[1], v.suspense[1], v.op), (0, 50 * USD, None));
    // token says only 30 are ours beyond the ledger: credit 30, keep 20
    ctx_h("anyone", 1_000, 200, vec![]);
    v.reconcile(acc("t1"));
    ctx_h("vault", 1_000, 201, vec![ok_u128(30 * USD)]);
    v.on_reconcile(1, 200, v.op_id);
    assert_eq!((v.balances[1], v.suspense[1]), (30 * USD, 20 * USD));
    // never more than suspense, however much the token shows
    ctx_h("anyone", 1_000, 300, vec![]);
    v.reconcile(acc("t1"));
    ctx_h("vault", 1_000, 301, vec![ok_u128(500 * USD)]);
    v.on_reconcile(1, 300, v.op_id);
    assert_eq!((v.balances[1], v.suspense[1]), (50 * USD, 0));
}

/// M2 mirror: an unreadable ft_transfer_call result keeps the input in at_dex, not home too; resync + reconcile fix it once.
#[test]
fn failed_dex_deposit_resolve_not_double_counted() {
    let mut v = vault(2);
    deposit(&mut v, "aa", 100, 1_000, 2);
    hire(&mut v, 2);
    ctx_at("tt", 1_000, vec![]);
    v.trade(7, acc("usdc"), acc("t1"), U128(50 * USD), U128(0));
    ctx_at("vault", 1_000, vec![prices(2)]);
    v.on_trade_prices(7, 0, 1, U128(50 * USD), U128(0), v.op_id);
    let p = oracle::read().unwrap();
    ctx_at("vault", 1_000, vec![PromiseResult::Failed]);
    v.on_dex_deposit(7, 0, 1, U128(50 * USD), U128(0), U128(50 * USD), p, v.op_id);
    assert_eq!((v.balances[0], v.at_dex[0], v.op, v.dex_synced), (50 * USD, 50 * USD, None, false));
    ctx_at("aa", 1_000, vec![]);
    assert!(panics(|| v.leave(U128(USD))).contains("funds at dex"));
    // the transfer never moved: ref has nothing, the 50 are home
    ctx_at("anyone", 1_000, vec![]);
    v.dex_recover(acc("usdc"));
    ctx_at("vault", 1_000, vec![deps(&[])]);
    v.on_dex_deposits(0, v.op_id);
    ctx_h("anyone", 1_000, 100, vec![]);
    v.reconcile(acc("usdc"));
    ctx_h("vault", 1_000, 101, vec![ok_u128(100 * USD)]);
    v.on_reconcile(0, 100, v.op_id);
    assert_eq!((v.balances[0], v.at_dex[0], v.suspense[0], v.dex_synced), (100 * USD, 0, 0, true));
}

/// M3: leave with a token stuck at ref: balances paid now, the at_dex slice becomes an iou claimed after dex_recover.
#[test]
fn leave_with_stuck_token_gets_iou() {
    let mut v = vault(2);
    deposit(&mut v, "aa", 100, 1_000, 2);
    deposit(&mut v, "bb", 100, 1_000, 2);
    v.balances[0] -= 60 * USD;
    v.at_dex[1] = 60 * USD; // parked after a failed withdraw: synced
    let paid = v.storage.get(&acc("aa")).copied().unwrap();
    ctx_at("aa", 1_000, vec![]);
    v.leave(U128(100 * USD));
    ctx_at("vault", 1_000, vec![prices(2)]);
    v.on_leave(acc("aa"), U128(100 * USD), v.flow_gen);
    assert_eq!((v.balances[0], v.at_dex[1], v.dex_iou[1]), (70 * USD, 30 * USD, 30 * USD));
    assert_eq!(v.get_dex_owed(acc("aa")), vec![(acc("t1"), U128(30 * USD))]);
    // row paid by aa's deposit (plus the leave sync)
    assert!(v.storage.get(&acc("aa")).copied().unwrap() < paid - dao::DAO_STORAGE.as_yoctonear());
    // bb's value is exact: 70 usdc + 30 t1 at ref
    assert_eq!(v.vault_value(&oracle::read().unwrap()), Some(100 * USD));
    ctx_at("aa", 1_000, vec![]);
    assert!(panics(|| v.claim(acc("t1"))).contains("iou still at dex"));
    ctx_at("anyone", 1_000, vec![]);
    v.dex_recover(acc("t1"));
    ctx_at("vault", 1_000, vec![deps(&[("t1", 60 * USD)])]);
    v.on_dex_deposits(1, v.op_id);
    ctx_at("vault", 1_000, vec![ok_u128(60 * USD)]);
    v.on_dex_withdraw(1, U128(60 * USD), v.op_id);
    assert_eq!((v.balances[1], v.at_dex[1], v.dex_iou[1], v.iou_home[1]), (30 * USD, 0, 0, 30 * USD));
    ctx_at("aa", 1_000, vec![]);
    v.claim(acc("t1"));
    assert_eq!((v.iou_home[1], v.out[1]), (0, 30 * USD));
    assert!(v.get_dex_owed(acc("aa")).is_empty());
    ctx_at("vault", 1_000, vec![PromiseResult::Successful(vec![])]);
    v.on_payout(acc("aa"), acc("t1"), U128(30 * USD));
    assert_eq!(v.out[1], 0);
}
