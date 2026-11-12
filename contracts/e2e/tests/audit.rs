//! Security audit regressions on the sandbox (real sputnik, oracle, ref). Run: cargo test -p pakt-e2e --test audit -- --nocapture
use near_workspaces::types::{AccountDetailsPatch, NearToken};
use near_workspaces::Account;
use pakt_e2e::*;
use serde_json::json;

const D: u128 = USDC;

async fn funded() -> anyhow::Result<(Env, Pakt, [Account; 3])> {
    let e = setup().await?;
    let [a, b, c] = [e.user("a", 1000).await?, e.user("b", 1000).await?, e.user("c", 1000).await?];
    let p = e.create_pakt(&a, "moon", None).await?;
    for (who, usd) in [(&a, 100), (&b, 200), (&c, 300)] {
        ok(e.deposit(who, &p.vault, usd, "").await?)?;
    }
    Ok((e, p, [a, b, c]))
}

/// C1: vault NEAR under the reserve refuses deposits before locking; leave still works; a top-up restores deposits.
#[tokio::test]
async fn low_near_vault_refuses_deposits_but_never_locks() -> anyhow::Result<()> {
    let (e, p, [a, _, _]) = funded().await?;
    let info = e.worker.view_account(&p.vault).await?;
    // 0.4 NEAR free: under the 0.5 reserve
    let low = NearToken::from_yoctonear(info.storage_usage as u128 * 10u128.pow(19) + 4 * 10u128.pow(23));
    e.worker.patch(&p.vault).account_from_current(move |x| AccountDetailsPatch::from(x).balance(low)).transact().await?;

    let d = e.user("d", 100).await?;
    let r = e.deposit(&d, &p.vault, 10, "").await?;
    assert!(logs(&r).contains("refund: vault low on near"), "{r:?}");
    assert_eq!(e.usdc_of(d.id()).await?, 100 * D);
    assert!(e.state(&p.vault).await?["op"].is_null());
    ok(a.call(&p.vault, "leave").args_json(json!({"shares": D.to_string()})).gas(TGAS300).transact().await?)?;
    assert!(e.state(&p.vault).await?["op"].is_null());

    ok(e.root.transfer_near(&p.vault, NearToken::from_near(1)).await?.into())?;
    ok(e.deposit(&d, &p.vault, 10, "").await?)?;
    assert_eq!(e.usdc_of(d.id()).await?, 90 * D);
    Ok(())
}

/// C2: sybil majority hires itself with unlimited caps. It must wait out the trade delay
/// (members can leave), then the period slippage budget caps the bleed under 3%.
#[tokio::test]
async fn sybil_trader_waits_delay_and_bleed_is_capped() -> anyhow::Result<()> {
    let (e, p, _) = funded().await?;
    let mut sy = vec![];
    for i in 0..4 {
        let s = e.user(&format!("s{i}"), 5).await?;
        ok(e.deposit(&s, &p.vault, 5, "").await?)?;
        sy.push(s);
    }
    let voters: Vec<&Account> = sy.iter().collect();
    let huge = (1_000_000_000 * D).to_string();
    let args = json!({"account": sy[0].id(), "budget": huge, "max_per_trade": huge, "fee_bps": 3000, "stop_loss_bps": 9000});
    assert_eq!(e.dao_call(&p.dao, &voters, &p.vault, "offer_trader", args).await?, "Approved");
    ok(sy[0].call(&p.vault, "accept_offer").gas(TGAS300).transact().await?)?;

    // attacker-run deep pools, 1.5% off the $60k oracle each way (+0.3% pool fee): inside the 2% floor
    let dear = e.pool(10_000_000 * D, 10_000_000 * 100_000_000 / 60_900).await?;
    let cheap = e.pool(10_000_000 * D, 10_000_000 * 100_000_000 / 59_100).await?;
    let r = e.trade(&sy[0], &p.vault, dear, &e.usdc, &e.btc, 100 * D, 0).await?;
    assert!(r.is_failure() && format!("{r:?}").contains("trade delay"), "{r:?}");

    e.wait_trade(&p.vault).await?;
    let mut all = String::new();
    for _ in 0..3 {
        let (bal, _) = e.ledger(&p.vault).await?;
        all += &logs(&e.trade(&sy[0], &p.vault, dear, &e.usdc, &e.btc, bal[0], 0).await?);
        let (bal, _) = e.ledger(&p.vault).await?;
        all += &logs(&e.trade(&sy[0], &p.vault, cheap, &e.btc, &e.usdc, bal[1], 0).await?);
    }
    let (bal, at_dex) = e.ledger(&p.vault).await?;
    let value = bal[0] + at_dex[0] + (bal[1] + at_dex[1]) * 60_000 * D / 100_000_000;
    println!("vault after sybil trades: {bal:?} at_dex {at_dex:?} value ${}", value as f64 / D as f64);
    assert!(all.contains("trade refused: period slippage budget"), "{all}");
    assert!(value >= 620 * D * 97 / 100, "lost over 3%: {value}");
    Ok(())
}

/// M1: each member sync pays the dao for its stored proposal, so dao free NEAR never shrinks.
#[tokio::test]
async fn member_sync_pays_dao_storage() -> anyhow::Result<()> {
    let (e, p, _) = funded().await?;
    let free = |a: &near_workspaces::types::AccountDetails| a.balance.as_yoctonear().saturating_sub(a.storage_usage as u128 * 10u128.pow(19));
    let d0 = e.worker.view_account(&p.dao).await?;
    let x = e.user("x", 5).await?;
    ok(e.deposit(&x, &p.vault, 5, "").await?)?;
    assert!(e.dao_members(&p.dao).await?.contains(&x.id().to_string()));
    let d1 = e.worker.view_account(&p.dao).await?;
    println!("dao +{} bytes, free {} -> {} yN", d1.storage_usage - d0.storage_usage, free(&d0), free(&d1));
    assert!(free(&d1) >= free(&d0), "dao paid for the sync");
    Ok(())
}
