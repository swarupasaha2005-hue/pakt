//! Security audit PoCs. Fixed ones assert the attack fails; `known_*` pin disclosed, unfixed behaviour.
use near_sdk::json_types::U128;
use near_sdk::serde_json::{json, to_vec};
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::{testing_env, AccountId, Gas, NearToken, PromiseResult, RuntimeFeesConfig};

use super::*;

const USD: u128 = 1_000_000;

fn acc(s: &str) -> AccountId {
    s.parse().unwrap()
}

fn ctx_at(pred: &str, ms: u64, results: Vec<PromiseResult>) {
    ctx_pay(pred, ms, NearToken::from_yoctonear(0), results);
}

fn ctx_pay(pred: &str, ms: u64, deposit: NearToken, results: Vec<PromiseResult>) {
    testing_env!(
        VMContextBuilder::new()
            .current_account_id(acc("vault"))
            .predecessor_account_id(acc(pred))
            .signer_account_id(acc(pred))
            .prepaid_gas(Gas::from_tgas(300))
            .attached_deposit(deposit)
            .block_timestamp(ms * 1_000_000)
            .build(),
        near_sdk::test_vm_config(),
        RuntimeFeesConfig::test(),
        Default::default(),
        results
    );
}

/// usdc at `usdc_usd`, btc at `btc_usd` per whole btc (8 dec)
fn prices(usdc_usd: f64, btc_usd: f64) -> PromiseResult {
    let m = (usdc_usd * 10_000.0).round() as u128; // usdc 6 dec: usd = raw*m/1e10
    let b = (btc_usd * 100.0).round() as u128; // btc 8 dec: usd = raw*b/1e10
    PromiseResult::Successful(
        to_vec(&json!({"timestamp": "1", "recency_duration_sec": 90, "prices": [
            {"asset_id": "usdc", "price": {"multiplier": m.to_string(), "decimals": 10}},
            {"asset_id": "btc", "price": {"multiplier": b.to_string(), "decimals": 10}},
        ]}))
        .unwrap(),
    )
}

fn vault() -> Vault {
    ctx_at("factory", 1_000, vec![]);
    Vault::new(VaultConfig {
        dao: acc("dao"),
        oracle: acc("oracle"),
        base_token: acc("usdc"),
        whitelist: vec![acc("usdc"), acc("btc")],
        platform: acc("platform"),
        join_mode: JoinMode::Open,
        invite_key: None,
        min_deposit: U128(5 * USD),
        dao_bond: U128(0),
        dex: acc("ref"),
        settle_period_ms: 7 * DAY_MS,
        trade_delay_ms: MIN_TRADE_DELAY_MS,
    })
}

fn deposit(v: &mut Vault, who: &str, usd: u128, ms: u64, p: PromiseResult) {
    v.storage.insert(acc(who), storage::STORAGE_FEE.as_yoctonear());
    ctx_at("usdc", ms, vec![]);
    let _ = v.ft_on_transfer(acc(who), U128(usd * USD), String::new());
    ctx_at("vault", ms, vec![p]);
    assert_eq!(v.on_deposit(acc(who), U128(usd * USD), v.flow_gen).0, 0, "deposit refunded");
}

fn shares(v: &Vault, who: &str) -> u128 {
    v.holders.get(&acc(who)).map_or(0, |h| h.shares.0)
}

fn hire(v: &mut Vault, ms: u64, p: PromiseResult) {
    ctx_at("dao", ms, vec![]);
    v.offer_trader(acc("tt"), U128(500 * USD), U128(50 * USD), 3_000, 9_000);
    ctx_at("tt", ms, vec![]);
    v.accept_offer();
    ctx_at("vault", ms, vec![p]);
    v.on_accept(acc("tt"), v.op_id);
}

/// L1, disclosed: settle_period_ms is meant to space fee marks a week apart, but any $5 deposit
/// (or a 1-share leave) crystallizes fees at once. A trader can mark at every
/// short oracle spike and keep fees on gains that revert minutes later.
#[test]
fn known_fee_mark_any_time_via_dust_deposit() {
    let mut v = vault();
    deposit(&mut v, "aa", 1_000, 1_000, prices(1.0, 60_000.0));
    hire(&mut v, 1_000, prices(1.0, 60_000.0));
    // a public settle is refused: period not over
    ctx_at("anyone", 2_000, vec![]);
    let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| v.settle()));
    assert!(r.is_err(), "settle should be rate limited");
    // usdc oracle blips +10% for one block; trader deposits $5 at that block
    deposit(&mut v, "tt", 5, 2_000, prices(1.10, 60_000.0));
    let fee = shares(&v, "tt");
    assert!(fee > 25 * USD, "trader fee shares minted outside settle period: {fee}");
    // blip reverts: the fee is kept (hwm ratchet), members pay for a gain that never existed
    let hwm = v.hwm;
    deposit(&mut v, "bb", 5, 3_000, prices(1.0, 60_000.0));
    assert_eq!(v.hwm, hwm);
}

/// L2 fixed: stale Add landing after the Remove re-marks the account, so `sync_member` repairs the dao.
#[test]
fn member_sync_out_of_order_stays_repairable() {
    let mut v = vault();
    deposit(&mut v, "aa", 100, 1_000, prices(1.0, 60_000.0));
    deposit(&mut v, "xx", 5, 1_000, prices(1.0, 60_000.0));
    assert!(v.pending_sync.contains(&acc("xx"))); // Add(xx) in flight
    ctx_at("xx", 1_000, vec![]);
    v.leave(U128(shares(&v, "xx")));
    ctx_at("vault", 1_000, vec![prices(1.0, 60_000.0)]);
    v.on_leave(acc("xx"), U128(5 * USD), v.flow_gen); // Remove(xx) in flight too
    // Remove's act lands first, then the stale Add's act lands (dao now HAS xx)
    ctx_at("vault", 1_000, vec![PromiseResult::Successful(b"null".to_vec())]);
    v.on_synced(acc("xx"), false);
    ctx_at("vault", 1_000, vec![PromiseResult::Successful(b"null".to_vec())]);
    v.on_synced(acc("xx"), true);
    assert!(v.pending_sync.contains(&acc("xx")), "drift still tracked");
    assert!(v.holders.get(&acc("xx")).is_none());
    ctx_pay("anyone", 1_000, dao::DAO_STORAGE, vec![]);
    let _ = v.sync_member(acc("xx"));
    // repair lands: Remove matches, cleared
    ctx_at("vault", 1_000, vec![PromiseResult::Successful(b"null".to_vec())]);
    v.on_synced(acc("xx"), false);
    assert!(!v.pending_sync.contains(&acc("xx")));
}

/// M3, disclosed: deposits are priced by the oracle, leaves pay in kind. When the oracle lags a
/// move in a held token, deposit-then-leave extracts value from members with no fee.
#[test]
fn known_oracle_lag_deposit_then_leave_in_kind() {
    let mut v = vault();
    deposit(&mut v, "aa", 1_000, 1_000, prices(1.0, 60_000.0));
    // vault holds $1000 usdc + 1 btc (via trades)
    v.balances[1] = 100_000_000;
    // market btc is $66k, oracle still says $60k (10% lag)
    deposit(&mut v, "eve", 10_000, 1_000, prices(1.0, 60_000.0));
    let s = shares(&v, "eve");
    ctx_at("eve", 1_000, vec![]);
    v.leave(U128(s));
    ctx_at("vault", 1_000, vec![prices(1.0, 60_000.0)]);
    let (u0, b0) = (v.balances[0], v.balances[1]);
    v.on_leave(acc("eve"), U128(s), v.flow_gen);
    let (got_usdc, got_btc) = (u0 - v.balances[0], b0 - v.balances[1]);
    let got_usd_at_market = got_usdc as f64 / USD as f64 + got_btc as f64 / 1e8 * 66_000.0;
    assert!(got_usd_at_market > 10_250.0, "eve turned $10000 into ${got_usd_at_market}");
}

/// L1 family, disclosed: fee on stablecoin oracle noise: with only the base token held and no trade at all,
/// a +0.1% usdc oracle tick pays the trader. Each new tick high is charged again.
#[test]
fn known_fee_on_base_token_noise_without_trading() {
    let mut v = vault();
    deposit(&mut v, "aa", 100_000, 1_000, prices(0.999, 60_000.0));
    hire(&mut v, 1_000, prices(0.999, 60_000.0));
    deposit(&mut v, "bb", 5, 2_000, prices(1.000, 60_000.0));
    assert!(shares(&v, "tt") > 0, "trader paid for usdc oracle noise");
}
