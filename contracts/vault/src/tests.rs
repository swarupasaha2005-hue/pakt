use near_sdk::json_types::U128;
use near_sdk::serde_json::{json, to_vec};
use near_sdk::test_utils::{get_logs, VMContextBuilder};
use near_sdk::{testing_env, AccountId, Gas, NearToken, PromiseOrValue, PromiseResult, RuntimeFeesConfig};

use super::*;

const USD: u128 = 1_000_000;

fn acc(s: &str) -> AccountId {
    s.parse().unwrap()
}

fn ctx_at(pred: &str, ms: u64, results: Vec<PromiseResult>) {
    testing_env!(
        VMContextBuilder::new()
            .current_account_id(acc("vault"))
            .predecessor_account_id(acc(pred))
            .signer_account_id(acc(pred))
            .prepaid_gas(Gas::from_tgas(300))
            .attached_deposit(NearToken::from_yoctonear(0))
            .block_timestamp(ms * 1_000_000)
            .build(),
        near_sdk::test_vm_config(),
        RuntimeFeesConfig::test(),
        Default::default(),
        results
    );
}

fn ctx(pred: &str) {
    ctx_at(pred, 1_000, vec![]);
}

/// oracle reply: usdc price as usd per whole token (6 dec)
fn prices(usdc_usd: f64) -> PromiseResult {
    let mult = (usdc_usd * 10_000.0).round() as u128; // usd = raw * mult / 1e10
    PromiseResult::Successful(
        to_vec(&json!({"timestamp": "1", "recency_duration_sec": 90, "prices": [
            {"asset_id": "usdc", "price": {"multiplier": mult.to_string(), "decimals": 10}},
            {"asset_id": "btc", "price": {"multiplier": "7344200", "decimals": 10}},
        ]}))
        .unwrap(),
    )
}

fn no_prices() -> PromiseResult {
    PromiseResult::Successful(to_vec(&json!({"timestamp": "1", "recency_duration_sec": 90, "prices": [
        {"asset_id": "usdc", "price": null}, {"asset_id": "btc", "price": null}]}))
    .unwrap())
}

fn vault_with(mode: JoinMode, hash: Option<String>) -> Vault {
    ctx("factory");
    Vault::new(VaultConfig {
        dao: acc("dao"),
        oracle: acc("oracle"),
        base_token: acc("usdc"),
        whitelist: vec![acc("usdc"), acc("btc")],
        platform: acc("platform"),
        join_mode: mode,
        invite_key: hash,
        min_deposit: U128(5 * USD),
        dao_bond: U128(0),
        dex: acc("ref"),
        settle_period_ms: 7 * DAY_MS,
        trade_delay_ms: MIN_TRADE_DELAY_MS,
    })
}

fn vault() -> Vault {
    vault_with(JoinMode::Open, None)
}

/// full deposit round trip at a given usdc price
fn deposit(v: &mut Vault, who: &str, usd: u128, price: f64) -> u128 {
    v.storage.insert(acc(who), storage::STORAGE_FEE.as_yoctonear());
    ctx("usdc");
    let r = v.ft_on_transfer(acc(who), U128(usd * USD), String::new());
    assert!(matches!(r, PromiseOrValue::Promise(_)), "deposit should go async");
    ctx_at("vault", 1_000, vec![prices(price)]);
    v.on_deposit(acc(who), U128(usd * USD), v.flow_gen).0
}

fn shares(v: &Vault, who: &str) -> u128 {
    v.holders.get(&acc(who)).map_or(0, |h| h.shares.0)
}

/// usd value of a holder at a usdc price
fn worth(v: &Vault, who: &str, price: f64) -> f64 {
    let total = v.balances[0] as f64 * price;
    total * shares(v, who) as f64 / v.total_shares as f64 / USD as f64
}

fn hire(v: &mut Vault, fee_bps: u16, price: f64) {
    ctx("dao");
    v.offer_trader(acc("tt"), U128(500 * USD), U128(50 * USD), fee_bps, 2_500);
    ctx("tt");
    v.accept_offer();
    ctx_at("vault", 1_000, vec![prices(price)]);
    v.on_accept(acc("tt"), v.op_id);
}

fn settle_at(v: &mut Vault, price: f64) {
    ctx_at("anyone", 1_000 + 8 * DAY_MS, vec![]);
    v.settle();
    ctx_at("vault", 1_000 + 8 * DAY_MS, vec![prices(price)]);
    v.on_settle(v.flow_gen);
}

#[test]
fn first_and_second_deposit_shares() {
    let mut v = vault();
    assert_eq!(deposit(&mut v, "aa", 100, 1.0), 0);
    assert_eq!(shares(&v, "aa"), 100 * USD);
    // vault gains ~$100 of btc: same $100 now buys ~half the shares
    v.balances[1] = 136_163; // 0.00136163 btc ≈ $100
    assert_eq!(deposit(&mut v, "bb", 100, 1.0), 0);
    assert!(shares(&v, "bb").abs_diff(50 * USD) < 1_000);
    assert_eq!(v.members, 2);
    assert_eq!(v.op, None);
}

#[test]
fn refunds_bad_deposits() {
    let mut v = vault();
    ctx("btc");
    assert!(matches!(v.ft_on_transfer(acc("aa"), U128(10 * USD), String::new()), PromiseOrValue::Value(U128(x)) if x == 10 * USD));
    ctx("usdc");
    assert!(matches!(v.ft_on_transfer(acc("aa"), U128(4 * USD), String::new()), PromiseOrValue::Value(_)));
    // busy: an exclusive op in flight
    v.op = Some(Op::Trade);
    assert!(matches!(v.ft_on_transfer(acc("aa"), U128(10 * USD), String::new()), PromiseOrValue::Value(_)));
    v.op = None;
    // oracle down → refund and unlock
    let _ = v.ft_on_transfer(acc("aa"), U128(10 * USD), String::new());
    ctx_at("vault", 1_000, vec![no_prices()]);
    assert_eq!(v.on_deposit(acc("aa"), U128(10 * USD), v.flow_gen).0, 10 * USD);
    assert_eq!(v.op, None);
    assert_eq!(v.total_shares, 0);
}

#[test]
fn member_cap() {
    let mut v = vault();
    v.members = MAX_MEMBERS;
    ctx("usdc");
    assert!(matches!(v.ft_on_transfer(acc("new"), U128(10 * USD), String::new()), PromiseOrValue::Value(_)));
}

#[test]
fn invite_signature_bound_to_joiner() {
    // rfc8032 test key 1
    let secret = hex("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60");
    let public = hex("d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a");
    let sign = |who: &str| sig(&secret, &public, &format!("pakt-invite:vault:{who}"));
    let mut v = vault_with(JoinMode::Invite, Some(to_hex(&public)));
    for who in ["aa", "mallory"] {
        v.storage.insert(acc(who), storage::STORAGE_FEE.as_yoctonear());
    }
    ctx("usdc");
    let msg = |s: String| json!({"invite_sig": s}).to_string();
    assert!(matches!(v.ft_on_transfer(acc("aa"), U128(10 * USD), msg(sign("aa"))), PromiseOrValue::Promise(_)));
    v.flows = 0;
    // aa's signature replayed by mallory → refund
    assert!(matches!(v.ft_on_transfer(acc("mallory"), U128(10 * USD), msg(sign("aa"))), PromiseOrValue::Value(_)));
    assert!(matches!(v.ft_on_transfer(acc("mallory"), U128(10 * USD), String::new()), PromiseOrValue::Value(_)));
}

fn hex(s: &str) -> Vec<u8> {
    crate::hex_decode_opt(s).unwrap()
}

fn to_hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}

/// test-only signer: ed25519-dalek is a dev dep
fn sig(secret: &[u8], _public: &[u8], text: &str) -> String {
    use ed25519_dalek::Signer;
    let key = ed25519_dalek::SigningKey::from_bytes(secret.try_into().unwrap());
    to_hex(&key.sign(text.as_bytes()).to_bytes())
}

#[test]
fn donation_does_not_move_share_price() {
    let mut v = vault();
    deposit(&mut v, "aa", 100, 1.0);
    // plain ft_transfer to the vault never touches the internal ledger
    assert_eq!(v.balances[0], 100 * USD);
    deposit(&mut v, "bb", 100, 1.0);
    assert_eq!(shares(&v, "bb"), 100 * USD);
}

#[test]
fn pakt_md_fee_example() {
    let mut v = vault();
    deposit(&mut v, "aa", 100, 1.0);
    deposit(&mut v, "bb", 200, 1.0);
    deposit(&mut v, "cc", 300, 1.0);
    hire(&mut v, 2_000, 1.0);
    // +20%: $600 → $720
    settle_at(&mut v, 1.2);
    let near = |x: f64, y: f64| assert!((x - y).abs() < 0.01, "{x} != {y}");
    near(worth(&v, "platform", 1.2), 1.20);
    near(worth(&v, "tt", 1.2), 24.0);
    near(worth(&v, "aa", 1.2) - 100.0, 15.80);
    near(worth(&v, "bb", 1.2) - 200.0, 31.60);
    near(worth(&v, "cc", 1.2) - 300.0, 47.40);
    assert!(!v.holders.get(&acc("tt")).unwrap().member);
}

#[test]
fn no_fee_on_loss_or_recovery() {
    let mut v = vault();
    deposit(&mut v, "aa", 100, 1.0);
    hire(&mut v, 2_000, 1.0);
    settle_at(&mut v, 0.9);
    assert_eq!(shares(&v, "tt"), 0);
    v.last_settle_ms = 0;
    settle_at(&mut v, 1.0);
    assert_eq!(shares(&v, "tt"), 0);
    v.last_settle_ms = 0;
    settle_at(&mut v, 1.1);
    assert!(shares(&v, "tt") > 0);
}

#[test]
fn new_money_not_charged_for_old_profit() {
    let mut v = vault();
    deposit(&mut v, "aa", 100, 1.0);
    hire(&mut v, 2_000, 1.0);
    // price up, b joins: profit so far is marked before b's shares exist
    deposit(&mut v, "bb", 100, 1.5);
    let t_before = shares(&v, "tt");
    v.last_settle_ms = 0;
    settle_at(&mut v, 1.5);
    assert_eq!(shares(&v, "tt"), t_before);
}

#[test]
fn trader_not_paid_for_gains_before_hire() {
    let mut v = vault();
    deposit(&mut v, "aa", 100, 1.0);
    hire(&mut v, 2_000, 1.5);
    settle_at(&mut v, 1.5);
    assert_eq!(shares(&v, "tt"), 0);
}

#[test]
fn leave_pays_in_kind_and_drops_member() {
    let mut v = vault();
    deposit(&mut v, "aa", 100, 1.0);
    deposit(&mut v, "bb", 100, 1.0);
    v.balances[1] = 2_000; // some btc held
    ctx("aa");
    v.leave(U128(100 * USD));
    assert_eq!((v.op, v.flows), (None, 1));
    ctx_at("vault", 1_000, vec![prices(1.0)]);
    v.on_leave(acc("aa"), U128(100 * USD), v.flow_gen);
    assert_eq!(v.balances, vec![100 * USD, 1_000]);
    assert!(v.holders.get(&acc("aa")).is_none());
    assert_eq!(v.members, 1);
    assert!(v.pending_sync.contains(&acc("aa")));
    assert!(get_logs().iter().any(|l| l.contains("\"event\":\"leave\"")));
}

#[test]
fn leave_works_without_prices() {
    let mut v = vault();
    deposit(&mut v, "aa", 100, 1.0);
    ctx("aa");
    v.leave(U128(100 * USD));
    ctx_at("vault", 1_000, vec![no_prices()]);
    v.on_leave(acc("aa"), U128(100 * USD), v.flow_gen);
    assert_eq!(v.balances[0], 0);
    assert_eq!(v.op, None);
}

#[test]
#[should_panic(expected = "not enough shares")]
fn cannot_leave_with_more_than_held() {
    let mut v = vault();
    deposit(&mut v, "aa", 100, 1.0);
    ctx("aa");
    v.leave(U128(101 * USD));
}

#[test]
fn flows_overlap_but_exclusive_ops_wait() {
    let mut v = traded_vault();
    deposit(&mut v, "bb", 100, 1.0);
    // a leave and a deposit in flight together, both land
    ctx("aa");
    v.leave(U128(50 * USD));
    ctx("usdc");
    assert!(matches!(v.ft_on_transfer(acc("bb"), U128(10 * USD), String::new()), PromiseOrValue::Promise(_)));
    assert_eq!(v.flows, 2);
    ctx("tt");
    // refused without panic so the drain flag sticks: no new flows until the trade runs
    v.trade(7, acc("usdc"), acc("btc"), U128(USD), U128(0));
    assert!(v.op.is_none() && v.draining && get_logs().iter().any(|l| l.contains("busy: draining flows")));
    ctx("usdc");
    assert!(matches!(v.ft_on_transfer(acc("bb"), U128(10 * USD), String::new()), PromiseOrValue::Value(_)));
    assert!(get_logs().iter().any(|l| l.contains("refund: draining, retry")));
    ctx_at("vault", 1_000, vec![prices(1.0)]);
    assert_eq!(v.on_deposit(acc("bb"), U128(10 * USD), v.flow_gen).0, 0);
    ctx_at("vault", 1_000, vec![prices(1.0)]);
    v.on_leave(acc("aa"), U128(50 * USD), v.flow_gen);
    assert_eq!((v.flows, v.balances[0]), (0, 160 * USD));
    // trade in flight: deposit refunded, leave and settle refused
    start_trade(&mut v, 10, 0);
    assert_eq!(v.op, Some(Op::Trade));
    ctx("usdc");
    assert!(matches!(v.ft_on_transfer(acc("bb"), U128(10 * USD), String::new()), PromiseOrValue::Value(_)));
    v.at_dex[0] = 0; // isolate the lock check from the at_dex one
    ctx("aa");
    assert!(panics(|| v.leave(U128(USD))).contains("busy, retry"));
    ctx_at("anyone", 1_000 + 8 * DAY_MS, vec![]);
    assert!(panics(|| v.settle()).contains("busy, retry"));
}

#[test]
fn leave_needs_full_gas_and_8_payouts_fit() {
    let mut v = vault();
    deposit(&mut v, "aa", 100, 1.0);
    testing_env!(VMContextBuilder::new().current_account_id(acc("vault")).predecessor_account_id(acc("aa")).prepaid_gas(Gas::from_tgas(299)).build());
    assert!(panics(|| v.leave(U128(USD))).contains("attach at least"));
    assert!(oracle::GAS_PRICES.as_tgas() + shares::GAS_LEAVE_CB.as_tgas() <= shares::GAS_LEAVE.as_tgas() - 50);
}

#[test]
fn failed_payout_owed_then_claim() {
    let mut v = vault();
    ctx_at("vault", 1_000, vec![PromiseResult::Failed]);
    v.on_payout(acc("aa"), acc("usdc"), U128(7));
    assert_eq!(v.get_owed(acc("aa")), vec![(acc("usdc"), U128(7))]);
    ctx("aa");
    v.claim(acc("usdc"));
    assert!(v.get_owed(acc("aa")).is_empty());
}

#[test]
#[should_panic(expected = "only dao")]
fn offer_dao_only() {
    let mut v = vault();
    ctx("mallory");
    v.offer_trader(acc("mallory"), U128(USD), U128(USD), 2_000, 2_500);
}

#[test]
#[should_panic(expected = "fee must be 10-30%")]
fn fee_bounds() {
    let mut v = vault();
    ctx("dao");
    v.offer_trader(acc("tt"), U128(USD), U128(USD), 3_001, 2_500);
}

#[test]
#[should_panic(expected = "offer is not for you")]
fn only_offered_account_accepts() {
    let mut v = vault();
    ctx("dao");
    v.offer_trader(acc("tt"), U128(USD), U128(USD), 2_000, 2_500);
    ctx("mallory");
    v.accept_offer();
}

#[test]
#[should_panic(expected = "offer expired")]
fn offer_expires() {
    let mut v = vault();
    ctx("dao");
    v.offer_trader(acc("tt"), U128(USD), U128(USD), 2_000, 2_500);
    ctx_at("tt", 1_000 + 3 * DAY_MS, vec![]);
    v.accept_offer();
}

#[test]
fn decline_and_replace_offer() {
    let mut v = vault();
    ctx("dao");
    v.offer_trader(acc("tt"), U128(USD), U128(USD), 2_000, 2_500);
    v.offer_trader(acc("uu"), U128(USD), U128(USD), 1_500, 2_500);
    assert_eq!(v.offer.as_ref().unwrap().terms.account, acc("uu"));
    ctx("uu");
    v.decline_offer();
    assert!(v.offer.is_none());
}

#[test]
fn fire_works_without_prices() {
    let mut v = vault();
    deposit(&mut v, "aa", 100, 1.0);
    hire(&mut v, 2_000, 1.0);
    ctx("dao");
    v.fire();
    // waits for prices so the P/L reaches the record, trader paused meanwhile
    ctx_at("vault", 1_000, vec![no_prices()]);
    v.on_fire(v.op_id);
    assert!(v.fire_pending && v.trader.as_ref().unwrap().paused);
    assert_eq!(v.op, None);
    // an hour on, it fires anyway
    ctx_at("anyone", FIRE_WAIT_MS + 1_000, vec![]);
    v.finish_fire();
    ctx_at("vault", FIRE_WAIT_MS + 2_000, vec![no_prices()]);
    v.on_fire(v.op_id);
    assert!(v.trader.is_none() && !v.fire_pending);
    assert_eq!(v.op, None);
}

#[test]
fn stop_loss_pauses_and_dao_resumes() {
    let mut v = vault();
    deposit(&mut v, "aa", 100, 1.0);
    hire(&mut v, 2_000, 1.0);
    settle_at(&mut v, 0.7);
    assert!(v.trader.as_ref().unwrap().paused);
    ctx("dao");
    v.resume();
    assert!(!v.trader.as_ref().unwrap().paused);
}

#[test]
fn set_cap_resets_budget() {
    let mut v = vault();
    deposit(&mut v, "aa", 100, 1.0);
    hire(&mut v, 2_000, 1.0);
    v.trader.as_mut().unwrap().budget_used = U128(9);
    ctx("dao");
    v.set_cap(U128(900 * USD), U128(90 * USD));
    let t = v.trader.as_ref().unwrap();
    assert_eq!((t.budget.0, t.budget_used.0), (900 * USD, 0));
}

#[test]
fn events_ring_keeps_last_50() {
    let mut v = vault();
    ctx("dao");
    for _ in 0..60 {
        v.offer_trader(acc("tt"), U128(USD), U128(USD), 2_000, 2_500);
    }
    assert_eq!(v.get_events(None).len(), 50);
    assert_eq!(v.get_events(Some(3)).len(), 3);
}

#[test]
#[should_panic(expected = "base_token must be whitelist[0]")]
fn base_token_first() {
    ctx("factory");
    Vault::new(VaultConfig {
        dao: acc("dao"),
        oracle: acc("oracle"),
        base_token: acc("usdc"),
        whitelist: vec![acc("btc"), acc("usdc")],
        platform: acc("platform"),
        join_mode: JoinMode::Open,
        invite_key: None,
        min_deposit: U128(5 * USD),
        dao_bond: U128(0),
        dex: acc("ref"),
        settle_period_ms: 7 * DAY_MS,
        trade_delay_ms: MIN_TRADE_DELAY_MS,
    });
}

fn ok_u128(x: u128) -> PromiseResult {
    PromiseResult::Successful(to_vec(&U128(x)).unwrap())
}

fn price_data(usdc_usd: f64) -> oracle::PriceData {
    let PromiseResult::Successful(b) = prices(usdc_usd) else { unreachable!() };
    near_sdk::serde_json::from_slice(&b).unwrap()
}

/// $100 in, trader hired with budget $500 / max $50, stop-loss 25%
fn traded_vault() -> Vault {
    let mut v = vault();
    deposit(&mut v, "aa", 100, 1.0);
    hire(&mut v, 2_000, 1.0);
    // delay has its own test
    v.trade_after_ms = 0;
    v
}

/// trade() then the price hop; returns logs of the callback
fn start_trade(v: &mut Vault, usd: u128, min_out: u128) {
    ctx("tt");
    v.trade(7, acc("usdc"), acc("btc"), U128(usd * USD), U128(min_out));
    assert_eq!(v.op, Some(Op::Trade));
    ctx_at("vault", 1_000, vec![prices(1.0)]);
    v.on_trade_prices(7, 0, 1, U128(usd * USD), U128(min_out), v.op_id);
}

#[test]
fn oracle_floor_is_price_minus_slippage() {
    let p = price_data(1.0);
    // btc at $73,442: 1 sat = 7344200 / 1e10 usd
    let (value, floor) = trade::quote(&p, &acc("usdc"), 50 * USD, &acc("btc")).unwrap();
    assert_eq!(value, 50 * USD);
    let expected = 50 * USD * 10u128.pow(10) / (7_344_200 * USD);
    assert_eq!(floor, expected * 98 / 100);
    assert!(trade::quote(&price_data(1.0), &acc("usdc"), 1, &acc("nope")).is_none());
    let none = { let PromiseResult::Successful(b) = no_prices() else { unreachable!() }; near_sdk::serde_json::from_slice::<oracle::PriceData>(&b).unwrap() };
    assert!(trade::quote(&none, &acc("usdc"), USD, &acc("btc")).is_none());
}

#[test]
fn caps_per_trade_and_budget() {
    let mut t = traded_vault().trader.unwrap();
    assert!(trade::within_caps(&t, 50 * USD).is_ok());
    assert_eq!(trade::within_caps(&t, 50 * USD + 1), Err("over max per trade"));
    t.budget_used = U128(460 * USD);
    assert!(trade::within_caps(&t, 40 * USD).is_ok());
    assert_eq!(trade::within_caps(&t, 41 * USD), Err("over budget"));
}

#[test]
fn over_cap_refused_without_moving_funds() {
    let mut v = traded_vault();
    start_trade(&mut v, 60, 0);
    assert_eq!(v.op, None);
    assert_eq!((v.balances[0], v.at_dex[0]), (100 * USD, 0));
    assert!(get_logs().iter().any(|l| l.contains("trade refused: over max per trade")));
}

#[test]
fn no_prices_refuses_trade() {
    let mut v = traded_vault();
    ctx("tt");
    v.trade(7, acc("usdc"), acc("btc"), U128(10 * USD), U128(0));
    ctx_at("vault", 1_000, vec![no_prices()]);
    v.on_trade_prices(7, 0, 1, U128(10 * USD), U128(0), v.op_id);
    assert_eq!(v.op, None);
    assert_eq!(v.balances[0], 100 * USD);
}

#[test]
fn trade_happy_path_books_ledger_and_budget() {
    let mut v = traded_vault();
    start_trade(&mut v, 50, 0);
    assert_eq!((v.balances[0], v.at_dex[0]), (50 * USD, 50 * USD));
    ctx_at("vault", 1_000, vec![ok_u128(50 * USD)]);
    v.on_dex_deposit(7, 0, 1, U128(50 * USD), U128(1), U128(50 * USD), price_data(1.0), v.op_id);
    ctx_at("vault", 1_000, vec![ok_u128(68_000)]);
    v.on_swap(0, 1, U128(50 * USD), U128(50 * USD), price_data(1.0), v.op_id);
    assert_eq!((v.at_dex[0], v.at_dex[1]), (0, 68_000));
    assert_eq!(v.trader.as_ref().unwrap().budget_used.0, 50 * USD);
    assert!(get_logs().iter().any(|l| l.contains(r#""event":"trade","data":[{"trader":"tt","token_in":"usdc","amount_in":"50000000","token_out":"btc","amount_out":"68000","value":"50000000"}]"#)));
    ctx_at("vault", 1_000, vec![ok_u128(68_000)]);
    v.on_dex_withdraw(1, U128(68_000), v.op_id);
    assert_eq!((v.balances[1], v.at_dex[1], v.op), (68_000, 0, None));
}

#[test]
fn failed_deposit_restores_ledger() {
    let mut v = traded_vault();
    start_trade(&mut v, 50, 0);
    ctx_at("vault", 1_000, vec![ok_u128(0)]);
    v.on_dex_deposit(7, 0, 1, U128(50 * USD), U128(1), U128(50 * USD), price_data(1.0), v.op_id);
    assert_eq!((v.balances[0], v.at_dex[0], v.op), (100 * USD, 0, None));
}

#[test]
fn failed_withdraw_parks_then_recover() {
    let mut v = traded_vault();
    v.balances[0] -= 50 * USD;
    v.at_dex[0] = 50 * USD;
    v.op = Some(Op::Trade);
    ctx_at("vault", 1_000, vec![ok_u128(0)]);
    v.on_dex_withdraw(0, U128(50 * USD), v.op_id);
    assert_eq!((v.at_dex[0], v.op), (50 * USD, None));
    // parked funds still count toward value
    assert_eq!(v.vault_value(&price_data(1.0)), Some(100 * USD));
    ctx("anyone");
    v.dex_recover(acc("usdc"));
    assert_eq!(v.op, Some(Op::Recover));
    ctx_at("vault", 1_000, vec![ok_u128(50 * USD)]);
    v.on_dex_withdraw(0, U128(50 * USD), v.op_id);
    assert_eq!((v.balances[0], v.at_dex[0], v.op), (100 * USD, 0, None));
}

#[test]
#[should_panic(expected = "funds at dex")]
fn leave_blocked_while_funds_parked_unsynced() {
    let mut v = traded_vault();
    v.at_dex[1] = 5;
    v.dex_synced = false;
    ctx("aa");
    v.leave(U128(USD));
}

#[test]
fn trade_that_breaks_stop_loss_pauses() {
    let mut v = traded_vault();
    start_trade(&mut v, 50, 0);
    ctx_at("vault", 1_000, vec![ok_u128(50 * USD)]);
    v.on_dex_deposit(7, 0, 1, U128(50 * USD), U128(1), U128(50 * USD), price_data(1.0), v.op_id);
    // pool paid 10 sats for $50: vault worth ~$50 vs mark $100, past the 25% stop
    ctx_at("vault", 1_000, vec![ok_u128(10)]);
    v.on_swap(0, 1, U128(50 * USD), U128(50 * USD), price_data(1.0), v.op_id);
    assert!(v.trader.as_ref().unwrap().paused);
}

#[test]
#[should_panic(expected = "only trader")]
fn non_trader_cannot_trade() {
    let mut v = traded_vault();
    ctx("aa");
    v.trade(7, acc("usdc"), acc("btc"), U128(USD), U128(0));
}

#[test]
#[should_panic(expected = "trader paused")]
fn paused_trader_cannot_trade() {
    let mut v = traded_vault();
    v.trader.as_mut().unwrap().paused = true;
    ctx("tt");
    v.trade(7, acc("usdc"), acc("btc"), U128(USD), U128(0));
}

#[test]
#[should_panic(expected = "settle_period_ms >= 60000")]
fn settle_period_floor() {
    ctx("factory");
    Vault::new(VaultConfig {
        dao: acc("dao"),
        oracle: acc("oracle"),
        base_token: acc("usdc"),
        whitelist: vec![acc("usdc")],
        platform: acc("platform"),
        join_mode: JoinMode::Open,
        invite_key: None,
        min_deposit: U128(5 * USD),
        dao_bond: U128(0),
        dex: acc("ref"),
        settle_period_ms: 59_999,
        trade_delay_ms: MIN_TRADE_DELAY_MS,
    });
}

#[test]
fn low_near_parks_sync_without_panic() {
    let mut v = vault();
    v.dao_bond = u128::MAX / 2;
    assert!(deposit(&mut v, "aa", 100, 1.0) == 0);
    assert!(v.op.is_none() && v.pending_sync.contains(&acc("aa")));
    assert!(get_logs().iter().any(|l| l.contains("low storage or balance")));
}

/// explicit near balance on 1KB of storage, for reserve checks
fn ctx_near(pred: &str, balance: NearToken, deposit: NearToken, results: Vec<PromiseResult>) {
    testing_env!(
        VMContextBuilder::new()
            .current_account_id(acc("vault"))
            .predecessor_account_id(acc(pred))
            .signer_account_id(acc(pred))
            .prepaid_gas(Gas::from_tgas(300))
            .attached_deposit(deposit)
            .account_balance(balance)
            .storage_usage(1_000)
            .block_timestamp(1_000_000_000)
            .build(),
        near_sdk::test_vm_config(),
        RuntimeFeesConfig::test(),
        Default::default(),
        results
    );
}

fn panics(f: impl FnOnce()) -> String {
    let e = std::panic::catch_unwind(std::panic::AssertUnwindSafe(f)).expect_err("should panic");
    e.downcast_ref::<String>().cloned().unwrap_or_default()
}

#[test]
fn stale_lock_unlocks_after_ttl() {
    let mut v = vault();
    deposit(&mut v, "aa", 100, 1.0);
    ctx("aa");
    assert!(panics(|| v.unlock()).contains("nothing stale"));
    v.leave(U128(USD)); // callback never lands
    ctx_at("anyone", 1_000 + LOCK_TTL_MS - 1, vec![]);
    assert!(panics(|| v.unlock()).contains("nothing stale"));
    ctx_at("anyone", 1_000 + LOCK_TTL_MS, vec![]);
    let gen = v.flow_gen;
    v.unlock();
    assert_eq!((v.flows, v.flow_gen), (0, gen + 1));
    assert!(get_logs().iter().any(|l| l.contains(r#""event":"unlocked","data":[{"op":null,"flows":1}]"#)));
    // the dead leave's late callback changes nothing
    ctx_at("vault", 1_000 + LOCK_TTL_MS, vec![prices(1.0)]);
    v.on_leave(acc("aa"), U128(USD), gen);
    assert_eq!(shares(&v, "aa"), 100 * USD);
    // exclusive op too
    v.op = Some(Op::Trade);
    v.op_since_ms = 1_000;
    ctx_at("anyone", 1_000 + LOCK_TTL_MS, vec![]);
    v.unlock();
    assert_eq!(v.op, None);
}

#[test]
fn low_near_refuses_deposit_until_topped_up() {
    let mut v = vault();
    v.storage.insert(acc("aa"), storage::STORAGE_FEE.as_yoctonear());
    ctx_near("usdc", NearToken::from_millinear(400), NearToken::from_yoctonear(0), vec![]);
    assert!(matches!(v.ft_on_transfer(acc("aa"), U128(10 * USD), String::new()), PromiseOrValue::Value(_)));
    assert!(get_logs().iter().any(|l| l.contains("refund: vault low on near")));
    assert_eq!(v.op, None);
    ctx_near("usdc", NearToken::from_near(10), NearToken::from_yoctonear(0), vec![]);
    assert!(matches!(v.ft_on_transfer(acc("aa"), U128(10 * USD), String::new()), PromiseOrValue::Promise(_)));
}

#[test]
fn failed_payout_without_near_returns_to_pool() {
    let mut v = vault();
    // balance == storage cost: an owed row can't be paid for
    ctx_near("vault", NearToken::from_yoctonear(1_000 * 10u128.pow(19)), NearToken::from_yoctonear(0), vec![PromiseResult::Failed]);
    v.on_payout(acc("aa"), acc("usdc"), U128(7));
    assert!(v.get_owed(acc("aa")).is_empty());
    assert_eq!(v.balances[0], 7);
}

#[test]
fn trade_waits_for_delay_and_cap_raise_restarts_it() {
    let mut v = vault();
    deposit(&mut v, "aa", 100, 1.0);
    hire(&mut v, 2_000, 1.0);
    assert_eq!(v.trade_after_ms, 1_000 + MIN_TRADE_DELAY_MS);
    ctx_at("tt", 1_000 + MIN_TRADE_DELAY_MS - 1, vec![]);
    assert!(panics(|| v.trade(7, acc("usdc"), acc("btc"), U128(USD), U128(0))).contains("trade delay"));
    ctx_at("tt", 1_000 + MIN_TRADE_DELAY_MS, vec![]);
    v.trade(7, acc("usdc"), acc("btc"), U128(USD), U128(0));
    v.op = None;
    // lower caps: no new delay; higher max: delay again from now
    ctx_at("dao", 100_000, vec![]);
    v.set_cap(U128(400 * USD), U128(50 * USD));
    assert_eq!(v.trade_after_ms, 1_000 + MIN_TRADE_DELAY_MS);
    v.set_cap(U128(400 * USD), U128(60 * USD));
    assert_eq!(v.trade_after_ms, 100_000 + MIN_TRADE_DELAY_MS);
    ctx_at("tt", 100_000 + MIN_TRADE_DELAY_MS - 1, vec![]);
    assert!(panics(|| v.trade(7, acc("usdc"), acc("btc"), U128(USD), U128(0))).contains("trade delay"));
}

#[test]
fn slippage_budget_per_24h_window() {
    let mut v = traded_vault();
    start_trade(&mut v, 50, 0);
    ctx_at("vault", 1_000, vec![ok_u128(50 * USD)]);
    v.on_dex_deposit(7, 0, 1, U128(50 * USD), U128(1), U128(50 * USD), price_data(1.0), v.op_id);
    // 66_800 sats at $73,442 = $49.059256
    ctx_at("vault", 1_000, vec![ok_u128(66_800)]);
    v.on_swap(0, 1, U128(50 * USD), U128(50 * USD), price_data(1.0), v.op_id);
    assert_eq!(v.slip_used, 50 * USD - 49_059_256);
    v.op = None;
    // vault ~$99.06: bucket $1.486; 1 used + worst 2% of $25 = 1.5 → refused
    v.slip_used = USD;
    start_trade(&mut v, 25, 0);
    assert!(get_logs().iter().any(|l| l.contains("trade refused: period slippage budget")));
    assert_eq!((v.op, v.balances[0]), (None, 50 * USD));
    start_trade(&mut v, 20, 0);
    assert_eq!(v.at_dex[0], 20 * USD, "smaller trade fits");
    v.op = None;
    // set_cap and settle don't reset it; only time refills it
    ctx("dao");
    v.set_cap(U128(500 * USD), U128(50 * USD));
    settle_at(&mut v, 1.0);
    assert_eq!(v.slip_used, USD);
    v.trader.as_mut().unwrap().paused = false;
    ctx_at("tt", 1_000 + DAY_MS, vec![]);
    v.trade(7, acc("usdc"), acc("btc"), U128(USD), U128(0));
    ctx_at("vault", 1_000 + DAY_MS, vec![prices(1.0)]);
    v.on_trade_prices(7, 0, 1, U128(USD), U128(0), v.op_id);
    assert_eq!((v.slip_used, v.slip_since_ms), (0, 1_000 + DAY_MS));
}

#[test]
fn fire_while_busy_pauses_then_anyone_finishes() {
    let mut v = traded_vault();
    v.op = Some(Op::Trade);
    ctx("dao");
    v.fire();
    assert!(get_logs().iter().any(|l| l.contains(r#""event":"fire_pending","data":[{"trader":"tt"}]"#)));
    assert!(v.fire_pending && v.trader.as_ref().unwrap().paused);
    assert!(panics(|| v.resume()).contains("fire pending"));
    ctx("anyone");
    assert!(panics(|| v.finish_fire()).contains("busy"));
    v.op = None;
    ctx("tt");
    assert!(panics(|| v.trade(7, acc("usdc"), acc("btc"), U128(USD), U128(0))).contains("trader paused"));
    ctx("anyone");
    v.finish_fire();
    assert_eq!(v.op, Some(Op::Fire));
    ctx_at("vault", 1_000, vec![prices(1.0)]);
    v.on_fire(v.op_id);
    assert!(v.trader.is_none() && !v.fire_pending);
    ctx("anyone");
    assert!(panics(|| v.finish_fire()).contains("no fire pending"));
}

#[test]
fn sync_pays_dao_storage_and_retry_needs_it() {
    let mut v = vault();
    deposit(&mut v, "aa", 100, 1.0);
    let paid = near_sdk::test_utils::get_created_receipts().iter().any(|r| {
        r.receiver_id == acc("dao")
            && r.actions.iter().any(|a| matches!(a, near_sdk::mock::MockAction::Transfer { deposit, .. } if *deposit == dao::DAO_STORAGE))
    });
    assert!(paid, "no dao storage transfer");
    ctx("aa");
    assert!(panics(|| {
        let _ = v.sync_member(acc("aa"));
    })
    .contains("attach dao bond"));
    // excess over bond + fee goes back to the caller
    ctx_near("aa", NearToken::from_near(10), dao::DAO_STORAGE.saturating_mul(2), vec![]);
    let _ = v.sync_member(acc("aa"));
    assert!(sent(&acc("aa"), dao::DAO_STORAGE));
}

fn sent(to: &AccountId, amount: NearToken) -> bool {
    near_sdk::test_utils::get_created_receipts().iter().any(|r| {
        &r.receiver_id == to && r.actions.iter().any(|a| matches!(a, near_sdk::mock::MockAction::Transfer { deposit, .. } if *deposit == amount))
    })
}

#[test]
fn storage_gates_joining_pays_syncs_and_refunds() {
    let fee = storage::STORAGE_FEE;
    let mut v = vault();
    ctx("usdc");
    assert!(matches!(v.ft_on_transfer(acc("aa"), U128(10 * USD), String::new()), PromiseOrValue::Value(_)));
    assert!(get_logs().iter().any(|l| l.contains("refund: storage_deposit first")));
    let none = NearToken::from_yoctonear(0);
    ctx_near("aa", NearToken::from_near(10), fee.saturating_sub(NearToken::from_yoctonear(1)), vec![]);
    assert!(panics(|| {
        v.storage_deposit(None, None);
    })
    .contains("attach at least"));
    ctx_near("aa", NearToken::from_near(10), fee.saturating_mul(2), vec![]);
    assert_eq!(v.storage_deposit(None, None).total.0, fee.as_yoctonear());
    assert!(sent(&acc("aa"), fee), "excess refunded");
    assert_eq!(v.storage_balance_bounds().max.unwrap().0, fee.as_yoctonear());
    // join: the dao fee comes out of aa's own deposit
    ctx("usdc");
    let _ = v.ft_on_transfer(acc("aa"), U128(100 * USD), String::new());
    ctx_near("vault", NearToken::from_near(10), none, vec![prices(1.0)]);
    assert_eq!(v.on_deposit(acc("aa"), U128(100 * USD), v.flow_gen).0, 0);
    let left = fee.as_yoctonear() - dao::DAO_STORAGE.as_yoctonear();
    assert_eq!(v.storage_balance_of(acc("aa")).unwrap().total.0, left);
    ctx_near("aa", NearToken::from_near(10), NearToken::from_yoctonear(1), vec![]);
    assert!(panics(|| {
        v.storage_unregister(None);
    })
    .contains("holds shares"));
    ctx("aa");
    v.leave(U128(100 * USD));
    ctx_at("vault", 1_000, vec![prices(1.0)]);
    v.on_leave(acc("aa"), U128(100 * USD), v.flow_gen);
    let left = left - dao::DAO_STORAGE.as_yoctonear();
    assert_eq!(v.storage_balance_of(acc("aa")).unwrap().total.0, left);
    ctx_near("aa", NearToken::from_near(10), NearToken::from_yoctonear(1), vec![]);
    assert!(panics(|| {
        v.storage_unregister(None);
    })
    .contains("member sync pending"));
    ctx_at("vault", 1_000, vec![PromiseResult::Successful(b"null".to_vec())]);
    v.on_synced(acc("aa"), false);
    // L3: payout still in flight, its failure would need an owed row
    ctx_near("aa", NearToken::from_near(10), NearToken::from_yoctonear(1), vec![]);
    assert!(panics(|| {
        v.storage_unregister(None);
    })
    .contains("payouts in flight"));
    ctx_at("vault", 1_000, vec![PromiseResult::Successful(vec![])]);
    v.on_payout(acc("aa"), acc("usdc"), U128(100 * USD));
    ctx_near("aa", NearToken::from_near(10), NearToken::from_yoctonear(1), vec![]);
    assert!(v.storage_unregister(None));
    assert!(sent(&acc("aa"), NearToken::from_yoctonear(left)) && v.storage_balance_of(acc("aa")).is_none());
}

/// (kind, pnl, fee, deposit) of record_trader calls made in the current context
fn records() -> Vec<(String, i128, u128, NearToken)> {
    near_sdk::test_utils::get_created_receipts()
        .iter()
        .filter(|r| r.receiver_id == acc("factory"))
        .flat_map(|r| r.actions.clone())
        .filter_map(|a| match a {
            near_sdk::mock::MockAction::FunctionCallWeight { method_name, args, attached_deposit, .. } if method_name == b"record_trader" => {
                let j: near_sdk::serde_json::Value = near_sdk::serde_json::from_slice(&args).unwrap();
                assert_eq!(j["trader"], "tt");
                let n = |k: &str| j[k].as_str().unwrap().to_string();
                Some((j["kind"].as_str().unwrap().to_string(), n("pnl_usd_e6").parse().unwrap(), n("fee_usd_e6").parse().unwrap(), attached_deposit))
            }
            _ => None,
        })
        .collect()
}

#[test]
fn reputation_records_hire_marks_and_fire() {
    let mut v = vault();
    deposit(&mut v, "aa", 100, 1.0);
    hire(&mut v, 2_000, 1.0);
    let r = records();
    assert!(r.len() == 1 && r[0].0 == "Hire" && !r[0].3.is_zero(), "{r:?}");
    settle_at(&mut v, 1.1);
    assert_eq!(records(), vec![("Mark".to_string(), 10 * USD as i128, 2 * USD, NearToken::from_yoctonear(0))]);
    // back to $1: gross P/L returns to ~0, no fee
    v.last_settle_ms = 0;
    settle_at(&mut v, 1.0);
    let r = records();
    assert!(r.len() == 1 && r[0].0 == "Mark" && (r[0].1 + 10 * USD as i128).abs() < 10 && r[0].2 == 0, "{r:?}");
    // flat since the last mark: fire records only the fire
    ctx("dao");
    v.fire();
    ctx_at("vault", 1_000, vec![prices(1.0)]);
    v.on_fire(v.op_id);
    let r = records();
    assert!(r.len() == 1 && r[0].0 == "Fire" && r[0].3.is_zero(), "{r:?}");
}

fn record(hires: u32, pnl_usd: i128) -> PromiseResult {
    PromiseResult::Successful(to_vec(&json!({"hires": hires, "fires": hires, "settlements": 1,
        "profit_usd_e6": (pnl_usd * USD as i128).to_string(), "fees_earned_usd_e6": "0", "last_ms": 1})).unwrap())
}

/// member alice fast-hires tt on a $1000 vault; returns the vault for the callback step
fn quick(budget_usd: u128, rec: PromiseResult) -> Vault {
    let mut v = vault();
    deposit(&mut v, "alice", 1_000, 1.0);
    ctx("alice");
    let _ = v.quick_offer(acc("tt"), U128(budget_usd * USD), U128(10 * USD), 1_500, 2_000);
    ctx_at("vault", 1_000, vec![prices(1.0), rec]);
    v.on_quick_offer(acc("alice"), v.offer_terms_for_test(budget_usd));
    v
}

#[test]
fn quick_offer_with_strong_record() {
    let v = quick(250, record(3, 0));
    let o = v.offer.as_ref().unwrap();
    assert_eq!(o.terms.account, acc("tt"));
    assert_eq!(o.terms.budget.0, 250 * USD);
}

#[test]
#[should_panic(expected = "fast hire needs 3+ hires")]
fn quick_offer_needs_hires() {
    quick(100, record(2, 50));
}

#[test]
#[should_panic(expected = "fast hire needs 3+ hires")]
fn quick_offer_refuses_net_loss() {
    quick(100, record(9, -1));
}

#[test]
#[should_panic(expected = "fast hire needs 3+ hires")]
fn quick_offer_refuses_no_record() {
    quick(100, PromiseResult::Successful(b"null".to_vec()));
}

#[test]
#[should_panic(expected = "capped at 25% of the vault")]
fn quick_offer_budget_cap() {
    quick(251, record(5, 10));
}

#[test]
#[should_panic(expected = "members only")]
fn quick_offer_members_only() {
    let mut v = vault();
    ctx("mallory");
    let _ = v.quick_offer(acc("tt"), U128(USD), U128(USD), 1_500, 2_000);
}

#[test]
#[should_panic(expected = "an offer is already open")]
fn quick_offer_never_replaces_open_offer() {
    let mut v = vault();
    deposit(&mut v, "alice", 1_000, 1.0);
    ctx("dao");
    v.offer_trader(acc("uu"), U128(USD), U128(USD), 1_500, 2_000);
    ctx("alice");
    let _ = v.quick_offer(acc("tt"), U128(USD), U128(USD), 1_500, 2_000);
}

#[test]
fn dao_can_replace_quick_offer() {
    let mut v = quick(100, record(3, 1));
    ctx("dao");
    v.offer_trader(acc("uu"), U128(USD), U128(USD), 1_500, 2_000);
    assert_eq!(v.offer.as_ref().unwrap().terms.account, acc("uu"));
}

impl Vault {
    fn offer_terms_for_test(&self, budget_usd: u128) -> Trader {
        Trader { account: acc("tt"), fee_bps: 1_500, budget: U128(budget_usd * USD), max_per_trade: U128(10 * USD),
                 budget_used: U128(0), stop_loss_bps: 2_000, paused: false }
    }
}
