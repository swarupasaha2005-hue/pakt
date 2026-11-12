//! Gas: full leave from a pakt holding all 8 tokens, on the real sandbox runtime.
use near_workspaces::types::NearToken;
use near_workspaces::Contract;
use pakt_e2e::*;
use serde_json::json;

const D: u128 = USDC;
const TG: u64 = 1_000_000_000_000;
/// mirrors vault shares.rs: GAS_LEAVE_CB, and statics on_leave attaches (8 x (transfer 10 + payout cb 5), propose 15 + on_proposed 40)
const LEAVE_CB_TGAS: u64 = 230;
const ATTACHED_TGAS: u64 = 8 * 15 + 15 + 40;

/// usdc/x ref pool, `raw` a side (both 6 dec at $1)
async fn pool_with(e: &Env, x: &Contract, raw: u128) -> anyhow::Result<u64> {
    let id: u64 = e.root.call(e.dex.id(), "add_simple_pool").args_json(json!({"tokens": [e.usdc.id(), x.id()], "fee": 30}))
        .deposit(NearToken::from_millinear(100)).transact().await?.into_result()?.json()?;
    for t in [&e.usdc, x] {
        ok(e.root.call(t.id(), "mint").args_json(json!({"to": e.root.id(), "amount": raw.to_string()})).transact().await?)?;
        ok(e.ft_call(&e.root, t, e.dex.id(), raw, "").await?)?;
    }
    let amounts = json!([raw.to_string(), raw.to_string()]);
    ok(e.root.call(e.dex.id(), "add_liquidity").args_json(json!({"pool_id": id, "amounts": amounts})).deposit(NearToken::from_millinear(100)).transact().await?)?;
    Ok(id)
}

/// oracle prices for all 8: usdc + extras $1, btc $60k
async fn prices(e: &Env, extra: &[Contract]) -> anyhow::Result<()> {
    let p = |t: &Contract, m: u128, d: u8| json!({"asset_id": t.id(), "price": {"multiplier": m.to_string(), "decimals": d}});
    let mut all = vec![p(&e.usdc, 10_000, 10), p(&e.btc, 600_000_000, 12)];
    all.extend(extra.iter().map(|t| p(t, 10_000, 10)));
    ok(e.root.call(e.oracle.id(), "report_prices").args_json(json!({"prices": all})).transact().await?)
}

#[tokio::test]
async fn full_leave_8_tokens_fits_gas() -> anyhow::Result<()> {
    let e = setup().await?;
    let one = NearToken::from_yoctonear(1);
    let ft = std::fs::read(format!("{}/../res/pakt_mock_ft.wasm", env!("CARGO_MANIFEST_DIR")))?;
    let mut extra = vec![];
    for i in 2..8 {
        let acc = e.root.create_subaccount(&format!("tk{i}")).initial_balance(NearToken::from_near(10)).transact().await?.into_result()?;
        let t = acc.deploy(&ft).await?.into_result()?;
        let sym = format!("tK{i}");
        ok(t.call("new").args_json(json!({"owner": e.root.id(), "name": sym, "symbol": sym, "decimals": 6})).transact().await?)?;
        ok(e.root.call(e.oracle.id(), "add_asset").args_json(json!({"asset_id": t.id()})).deposit(one).transact().await?)?;
        ok(e.root.call(t.id(), "storage_deposit").args_json(json!({"account_id": e.dex.id()})).deposit(NearToken::from_millinear(10)).transact().await?)?;
        extra.push(t);
    }
    let extra_ids: Vec<_> = extra.iter().map(|t| t.id().clone()).collect();
    ok(e.root.call(e.dex.id(), "register_tokens").args_json(json!({"token_ids": extra_ids})).deposit(one).transact().await?)?;
    let mut cfg = e.view(e.factory.id(), "get_config", json!({})).await?;
    let mut wl = vec![e.usdc.id().clone(), e.btc.id().clone()];
    wl.extend(extra_ids.clone());
    cfg["tokens"] = json!(wl);
    ok(e.root.call(e.factory.id(), "set_config").args_json(json!({"config": cfg})).transact().await?)?;
    prices(&e, &extra).await?;

    let (a, b, t) = (e.user("a", 1000).await?, e.user("b", 1000).await?, e.user("t", 0).await?);
    let need: NearToken = e.factory.view("required_deposit").args_json(json!({"whitelist_len": 8})).await?.json()?;
    let r = a.call(e.factory.id(), "create_pakt")
        .args_json(json!({"name": "eight", "whitelist": wl, "stop_loss_bps": 5000, "join_mode": "Open",
                          "invite_key": null, "min_deposit": (5 * D).to_string()}))
        .deposit(need).gas(TGAS300).transact().await?;
    println!("create_pakt(8 tokens) burnt {:.2} TGas", r.total_gas_burnt.as_gas() as f64 / TG as f64);
    for o in r.receipt_outcomes() {
        println!("  {:<40} {:>6.2} TGas  {:?}", o.executor_id.as_str(), o.gas_burnt.as_gas() as f64 / TG as f64, o.is_success());
    }
    assert!(logs(&r).contains("pakt_created"), "8-token create_pakt failed: {r:?}");
    let pk = e.view(e.factory.id(), "get_pakt", json!({"name": "eight"})).await?;
    let (vault, dao): (near_workspaces::AccountId, near_workspaces::AccountId) = (pk["vault"].as_str().unwrap().parse()?, pk["dao"].as_str().unwrap().parse()?);
    // vault registered itself on every token in its init
    for t in &wl {
        assert!(!e.view(t, "storage_balance_of", json!({"account_id": vault})).await?.is_null(), "vault not registered on {t}");
    }

    for (who, usd) in [(&a, 100), (&b, 200)] {
        ok(e.deposit(who, &vault, usd, "").await?)?;
    }
    let args = json!({"account": t.id(), "budget": (500 * D).to_string(), "max_per_trade": (100 * D).to_string(),
                      "fee_bps": 2000, "stop_loss_bps": 5000});
    assert_eq!(e.dao_call(&dao, &[&a, &b], &vault, "offer_trader", args).await?, "Approved");
    ok(t.call(&vault, "accept_offer").gas(TGAS300).transact().await?)?;
    let mut pools = vec![(e.fair_pool().await?, &e.btc)];
    for x in &extra {
        pools.push((pool_with(&e, x, 100_000 * D).await?, x));
    }
    e.wait_trade(&vault).await?;
    prices(&e, &extra).await?;
    for (pool, x) in &pools {
        ok(e.trade(&t, &vault, *pool, &e.usdc, x, 10 * D, 0).await?)?;
    }
    let s = e.state(&vault).await?;
    let held: Vec<u128> = s["balances"].as_array().unwrap().iter().map(|r| r[1].as_str().unwrap().parse().unwrap()).collect();
    assert!(held.len() == 8 && held.iter().all(|x| *x > 0) && s["op"].is_null(), "vault not holding all 8: {s}");

    // leaver must be registered on every token to receive
    let all: Vec<&Contract> = [&e.usdc, &e.btc].into_iter().chain(extra.iter()).collect();
    for tk in &all {
        ok(a.call(tk.id(), "storage_deposit").args_json(json!({"account_id": a.id()})).deposit(NearToken::from_millinear(10)).transact().await?)?;
    }
    let mut before = vec![];
    for tk in &all {
        before.push(e.ft_of(tk, a.id()).await?);
    }
    assert!(e.dao_members(&dao).await?.contains(&a.id().to_string()));
    prices(&e, &extra).await?;

    let shares = e.shares(&vault, a.id()).await?;
    let r = a.call(&vault, "leave").args_json(json!({"shares": shares.to_string()})).gas(TGAS300).transact().await?;
    let total = r.total_gas_burnt.as_gas();
    println!("leave total burnt {:.2} TGas", total as f64 / TG as f64);
    let (mut on_leave, mut payouts) = (0u64, vec![]);
    for (i, o) in r.receipt_outcomes().iter().enumerate() {
        let g = o.gas_burnt.as_gas();
        let log = o.logs.first().map(|l| l.chars().take(70).collect::<String>()).unwrap_or_default();
        println!("  #{i:<2} {:<40} {:>6.2} TGas  {log}", o.executor_id.as_str(), g as f64 / TG as f64);
        if o.executor_id == vault {
            if o.logs.iter().any(|l| l.contains(r#""event":"leave""#)) {
                on_leave = g;
            } else if i > 0 && g > TG && o.logs.is_empty() && o.receipt_ids.len() <= 1 {
                // on_payout: vault fn call (bare refunds burn 0.22), no logs, spawns nothing but a refund
                payouts.push(g);
            }
        }
    }
    let headroom = LEAVE_CB_TGAS as i64 * TG as i64 - (on_leave + ATTACHED_TGAS * TG) as i64;
    println!("on_leave burnt {:.2} TGas; + {ATTACHED_TGAS} attached of {LEAVE_CB_TGAS} budget -> headroom {:.2} TGas",
             on_leave as f64 / TG as f64, headroom as f64 / TG as f64);
    println!("on_payout x{}: {:?} TGas", payouts.len(), payouts.iter().map(|g| format!("{:.2}", *g as f64 / TG as f64)).collect::<Vec<_>>());
    ok(r)?;

    for (i, tk) in all.iter().enumerate() {
        let now = e.ft_of(tk, a.id()).await?;
        assert!(now > before[i], "no payout of {}: {} -> {now}", tk.id(), before[i]);
    }
    assert_eq!(e.shares(&vault, a.id()).await?, 0);
    assert!(e.view(&vault, "get_holder", json!({"account": a.id()})).await?.is_null());
    let s = e.state(&vault).await?;
    assert!(s["op"].is_null() && s["flows"] == json!(0), "vault stuck: {s}");
    assert!(e.view(&vault, "get_owed", json!({"account": a.id()})).await?.as_array().unwrap().is_empty(), "payout parked");
    assert!(!e.dao_members(&dao).await?.contains(&a.id().to_string()), "member sync did not run");
    assert_eq!(payouts.len(), 8, "expected 8 on_payout receipts");
    assert!(headroom >= 20 * TG as i64, "on_leave headroom {:.2} TGas < 20", headroom as f64 / TG as f64);
    Ok(())
}
