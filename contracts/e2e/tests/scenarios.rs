//! Pakt end to end on a local sandbox: real burrow oracle, real sputnik dao, real ref exchange, mock fts.
use near_workspaces::Account;
use pakt_e2e::*;
use serde_json::json;

/// $1 e6 and the rounding we allow on fee splits
const D: u128 = USDC;
const DUST: u128 = 2;

fn near(a: u128, b: u128) -> bool {
    a.abs_diff(b) <= DUST
}

/// open pakt with A $100, B $200, C $300 in; returns (env, pakt, [a, b, c])
async fn funded() -> anyhow::Result<(Env, Pakt, [Account; 3])> {
    let e = setup().await?;
    let [a, b, c] = [e.user("a", 1000).await?, e.user("b", 1000).await?, e.user("c", 1000).await?];
    let p = e.create_pakt(&a, "moon", None).await?;
    for (who, usd) in [(&a, 100), (&b, 200), (&c, 300)] {
        ok(e.deposit(who, &p.vault, usd, "").await?)?;
    }
    Ok((e, p, [a, b, c]))
}

/// members vote T in at `fee_bps`, T accepts
async fn hire(e: &Env, p: &Pakt, voters: &[&Account], t: &Account, fee_bps: u16) -> anyhow::Result<()> {
    let args = json!({"account": t.id(), "budget": (500 * D).to_string(), "max_per_trade": (100 * D).to_string(),
                      "fee_bps": fee_bps, "stop_loss_bps": 5000});
    assert_eq!(e.dao_call(&p.dao, voters, &p.vault, "offer_trader", args).await?, "Approved");
    ok(t.call(&p.vault, "accept_offer").gas(TGAS300).transact().await?)?;
    assert_eq!(e.state(&p.vault).await?["trader"]["account"], json!(t.id()));
    Ok(())
}

async fn settle(e: &Env, p: &Pakt) -> anyhow::Result<()> {
    e.wait_settle(&p.vault).await?;
    ok(e.root.call(&p.vault, "settle").gas(TGAS300).transact().await?)?;
    Ok(())
}

#[tokio::test]
async fn happy_path() -> anyhow::Result<()> {
    let (e, p, [a, b, c]) = funded().await?;
    let mut members = e.dao_members(&p.dao).await?;
    members.sort();
    assert_eq!(members, [a.id().to_string(), b.id().to_string(), c.id().to_string()]);

    let t = e.user("t", 0).await?;
    hire(&e, &p, &[&a, &b], &t, 2000).await?;
    // +20%: vault holds only tUSDC, so reprice it 1.00 -> 1.20
    e.prices(12_000).await?;
    settle(&e, &p).await?;

    for (who, want) in [(e.platform.id(), 1_200_000), (t.id(), 24 * D), (a.id(), 115_800_000), (b.id(), 231_600_000), (c.id(), 347_400_000)] {
        let got = e.worth(&p.vault, who, 12_000).await?;
        println!("{who}: {got}");
        assert!(near(got, want), "{who} worth {got}, want {want}");
    }
    Ok(())
}

#[tokio::test]
async fn leave_pays_in_kind_after_fees_and_drops_dao_member() -> anyhow::Result<()> {
    let (e, p, [a, b, c]) = funded().await?;
    let t = e.user("t", 0).await?;
    hire(&e, &p, &[&a, &b], &t, 2000).await?;
    e.prices(12_000).await?;
    let all = e.shares(&p.vault, b.id()).await?;
    ok(b.call(&p.vault, "leave").args_json(json!({"shares": all.to_string()})).gas(TGAS300).transact().await?)?;

    // fees marked first: B's $231.60 after fees, paid as tUSDC at $1.20 = 193 tUSDC
    assert!(near(e.usdc_of(b.id()).await?, 800 * D + 193 * D), "b got {}", e.usdc_of(b.id()).await?);
    assert!(near(e.worth(&p.vault, t.id(), 12_000).await?, 24 * D));
    assert_eq!(e.shares(&p.vault, b.id()).await?, 0);
    assert_eq!(e.state(&p.vault).await?["members"], 2);
    let members = e.dao_members(&p.dao).await?;
    assert!(!members.contains(&b.id().to_string()) && members.contains(&c.id().to_string()), "{members:?}");
    Ok(())
}

#[tokio::test]
async fn loss_then_recovery_charges_nothing() -> anyhow::Result<()> {
    let (e, p, [a, b, _]) = funded().await?;
    let t = e.user("t", 0).await?;
    hire(&e, &p, &[&a, &b], &t, 2000).await?;
    let hwm = e.state(&p.vault).await?["hwm"].clone();
    for px in [8_000, 10_000] {
        e.prices(px).await?;
        settle(&e, &p).await?;
        assert_eq!(e.shares(&p.vault, t.id()).await?, 0, "fee at price {px}");
        assert_eq!(e.shares(&p.vault, e.platform.id()).await?, 0);
        assert_eq!(e.state(&p.vault).await?["hwm"], hwm);
    }
    // only the part above the mark pays: 10% of $600 * 20%
    e.prices(11_000).await?;
    settle(&e, &p).await?;
    assert!(near(e.worth(&p.vault, t.id(), 11_000).await?, 12 * D));
    Ok(())
}

#[tokio::test]
async fn deposit_above_mark_pays_no_old_profit() -> anyhow::Result<()> {
    let (e, p, [a, b, _]) = funded().await?;
    let t = e.user("t", 0).await?;
    hire(&e, &p, &[&a, &b], &t, 2000).await?;
    e.prices(12_000).await?;
    let d = e.user("d", 1000).await?;
    ok(e.deposit(&d, &p.vault, 100, "").await?)?;
    // deposit marked the old profit first; D's 100 tUSDC = $120 stays whole through settle
    assert!(near(e.worth(&p.vault, d.id(), 12_000).await?, 120 * D));
    assert!(near(e.worth(&p.vault, t.id(), 12_000).await?, 24 * D));
    settle(&e, &p).await?;
    assert!(near(e.worth(&p.vault, d.id(), 12_000).await?, 120 * D));
    assert!(near(e.worth(&p.vault, t.id(), 12_000).await?, 24 * D));
    Ok(())
}

#[tokio::test]
async fn access_control() -> anyhow::Result<()> {
    let (e, p, [a, b, _]) = funded().await?;
    let t = e.user("t", 0).await?;
    let offer = json!({"account": t.id(), "budget": "100000000", "max_per_trade": "10000000", "fee_bps": 2000, "stop_loss_bps": 5000});
    let r = a.call(&p.vault, "offer_trader").args_json(&offer).transact().await?;
    assert!(r.is_failure() && format!("{r:?}").contains("only dao"), "{r:?}");

    assert_eq!(e.dao_call(&p.dao, &[&a, &b], &p.vault, "offer_trader", offer).await?, "Approved");
    let r = b.call(&p.vault, "accept_offer").gas(TGAS300).transact().await?;
    assert!(r.is_failure() && format!("{r:?}").contains("offer is not for you"), "{r:?}");
    ok(t.call(&p.vault, "accept_offer").gas(TGAS300).transact().await?)?;
    let r = a.call(&p.vault, "fire").gas(TGAS300).transact().await?;
    assert!(r.is_failure() && format!("{r:?}").contains("only dao"), "{r:?}");

    // members may only propose function calls: no membership or policy edits
    let x = e.user("x", 0).await?;
    for kind in [
        json!({"AddMemberToRole": {"member_id": x.id(), "role": "members"}}),
        json!({"RemoveMemberFromRole": {"member_id": b.id(), "role": "members"}}),
        json!({"ChangePolicyAddOrUpdateRole": {"role": {"name": "god", "kind": {"Group": [a.id()]}, "permissions": ["*:*"], "vote_policy": {}}}}),
    ] {
        let r = e.propose(&p.dao, &a, kind.clone()).await;
        assert!(r.is_err() && format!("{r:?}").contains("ERR_PERMISSION_DENIED"), "{kind} -> {r:?}");
    }
    Ok(())
}

#[tokio::test]
async fn factory_rejects_unlisted_tokens() -> anyhow::Result<()> {
    let e = setup().await?;
    let a = e.user("a", 0).await?;
    let need: near_workspaces::types::NearToken = e.factory.view("required_deposit").args_json(json!({"whitelist_len": 2})).await?.json()?;
    // fake token, then a listed token that is not an allowed base
    for wl in [json!([e.usdc.id(), e.oracle.id()]), json!([e.btc.id(), e.usdc.id()])] {
        let r = a
            .call(e.factory.id(), "create_pakt")
            .args_json(json!({"name": "bad", "whitelist": wl, "stop_loss_bps": 5000, "join_mode": "Open", "invite_key": null, "min_deposit": "5000000"}))
            .deposit(need)
            .gas(TGAS300)
            .transact()
            .await?;
        assert!(r.is_failure(), "{wl} accepted");
    }
    assert!(e.view(e.factory.id(), "get_pakt", json!({"name": "bad"})).await?.is_null());
    Ok(())
}

#[tokio::test]
async fn invite_only() -> anyhow::Result<()> {
    let e = setup().await?;
    let [a, b, c] = [e.user("a", 100).await?, e.user("b", 100).await?, e.user("c", 100).await?];
    let p = e.create_pakt(&a, "club", Some(invite_key(7))).await?;
    let a_msg = invite_msg(7, &p.vault, a.id());
    // replayed sig, no sig, wrong signer: all refunded
    for (who, msg) in [(&b, a_msg.clone()), (&c, String::new()), (&c, invite_msg(8, &p.vault, c.id()))] {
        let r = e.deposit(who, &p.vault, 50, &msg).await?;
        assert!(logs(&r).contains("refund: bad invite"), "{r:?}");
        assert_eq!(e.usdc_of(who.id()).await?, 100 * D);
    }
    ok(e.deposit(&a, &p.vault, 50, &a_msg).await?)?;
    assert_eq!(e.usdc_of(a.id()).await?, 50 * D);
    assert!(e.shares(&p.vault, a.id()).await? > 0);
    Ok(())
}

#[tokio::test]
async fn deposits_and_leaves_overlap_without_lock() -> anyhow::Result<()> {
    let (e, p, [a, b, _]) = funded().await?;
    // leave and deposit in flight together: both land, nothing refunded
    let leave = a.call(&p.vault, "leave").args_json(json!({"shares": (10 * D).to_string()})).gas(TGAS300).transact_async().await?;
    let dep = b
        .call(e.usdc.id(), "ft_transfer_call")
        .args_json(json!({"receiver_id": p.vault, "amount": (50 * D).to_string(), "msg": ""}))
        .deposit(near_workspaces::types::NearToken::from_yoctonear(1))
        .gas(TGAS300)
        .transact_async()
        .await?;
    ok(leave.await?)?;
    let r = dep.await?;
    assert!(!logs(&r).contains("refund"), "{:?}", r.logs());
    assert_eq!(e.usdc_of(b.id()).await?, 750 * D);
    // two leaves in the same block both go through
    let one = a.call(&p.vault, "leave").args_json(json!({"shares": (10 * D).to_string()})).gas(TGAS300).transact_async().await?;
    let two = b.call(&p.vault, "leave").args_json(json!({"shares": (10 * D).to_string()})).gas(TGAS300).transact_async().await?;
    ok(one.await?)?;
    ok(two.await?)?;
    let s = e.state(&p.vault).await?;
    assert!(s["op"].is_null() && s["flows"] == json!(0), "{s}");
    assert!(near(e.shares(&p.vault, b.id()).await?, 240 * D));
    Ok(())
}

#[tokio::test]
async fn failed_payout_is_owed_then_claimed() -> anyhow::Result<()> {
    let (e, p, [a, b, _]) = funded().await?;
    // trader never registered on tUSDC
    let t = e.root.create_subaccount("t").initial_balance(near_workspaces::types::NearToken::from_near(10)).transact().await?.into_result()?;
    hire(&e, &p, &[&a, &b], &t, 2000).await?;
    e.prices(12_000).await?;
    settle(&e, &p).await?;
    let fee = e.shares(&p.vault, t.id()).await?;
    ok(t.call(&p.vault, "leave").args_json(json!({"shares": fee.to_string()})).gas(TGAS300).transact().await?)?;
    let owed = e.view(&p.vault, "get_owed", json!({"account": t.id()})).await?;
    // $24 at $1.20 = 20 tUSDC
    let amt: u128 = owed[0][1].as_str().unwrap().parse()?;
    assert!(owed[0][0] == json!(e.usdc.id()) && near(amt, 20 * D), "{owed}");

    let storage = near_workspaces::types::NearToken::from_millinear(10);
    ok(t.call(e.usdc.id(), "storage_deposit").args_json(json!({})).deposit(storage).transact().await?)?;
    ok(t.call(&p.vault, "claim").args_json(json!({"token": e.usdc.id()})).gas(TGAS300).transact().await?)?;
    assert_eq!(e.usdc_of(t.id()).await?, amt);
    assert_eq!(e.view(&p.vault, "get_owed", json!({"account": t.id()})).await?, json!([]));
    Ok(())
}

#[tokio::test]
async fn fire_pays_profit_only_and_survives_dead_oracle() -> anyhow::Result<()> {
    let (e, p, [a, b, _]) = funded().await?;
    let t = e.user("t", 0).await?;
    hire(&e, &p, &[&a, &b], &t, 2000).await?;
    e.prices(11_000).await?;
    assert_eq!(e.dao_call(&p.dao, &[&a, &b], &p.vault, "fire", json!({})).await?, "Approved");
    let s = e.state(&p.vault).await?;
    assert!(s["trader"].is_null() && s["op"].is_null(), "{s}");
    assert!(near(e.worth(&p.vault, t.id(), 11_000).await?, 12 * D));

    // second trader, then the oracle dies: fire still goes through, no fee, lock clear
    let t2 = e.user("t2", 0).await?;
    hire(&e, &p, &[&a, &b], &t2, 2000).await?;
    e.prices(13_000).await?;
    e.stale_prices().await?;
    let px = e.view(e.oracle.id(), "get_price_data", json!({"asset_ids": [e.usdc.id()]})).await?;
    assert!(px["prices"][0]["price"].is_null(), "{px}");
    let r = e.deposit(&a, &p.vault, 10, "").await?;
    assert!(logs(&r).contains("refund: no prices"), "{r:?}");
    assert_eq!(e.dao_call(&p.dao, &[&a, &b], &p.vault, "fire", json!({})).await?, "Approved");
    let s = e.state(&p.vault).await?;
    assert!(s["trader"].is_null() && s["op"].is_null(), "{s}");
    assert_eq!(e.shares(&p.vault, t2.id()).await?, 0);
    Ok(())
}

/// funded pakt with T hired (budget $500, max $100) and a ref pool at the oracle price
async fn trading() -> anyhow::Result<(Env, Pakt, [Account; 3], Account, u64)> {
    let (e, p, abc) = funded().await?;
    let t = e.user("t", 0).await?;
    hire(&e, &p, &[&abc[0], &abc[1]], &t, 2000).await?;
    let pool = e.fair_pool().await?;
    e.wait_trade(&p.vault).await?;
    Ok((e, p, abc, t, pool))
}

fn budget_used(s: &serde_json::Value) -> u128 {
    s["trader"]["budget_used"].as_str().unwrap().parse().unwrap()
}

#[tokio::test]
async fn trade_happy_path() -> anyhow::Result<()> {
    let (e, p, _, t, pool) = trading().await?;
    let r = e.trade(&t, &p.vault, pool, &e.usdc, &e.btc, 50 * D, 0).await?;
    println!("trade burnt {}", r.total_gas_burnt);
    let line = r.logs().into_iter().find(|l| l.contains(r#""event":"trade""#)).unwrap_or_else(|| panic!("{r:?}"));
    let ev: serde_json::Value = serde_json::from_str(line.trim_start_matches("EVENT_JSON:"))?;
    let d = &ev["data"][0];
    assert_eq!((d["trader"].clone(), d["token_in"].clone(), d["amount_in"].clone(), d["value"].clone()),
               (json!(t.id()), json!(e.usdc.id()), json!((50 * D).to_string()), json!((50 * D).to_string())));
    let out: u128 = d["amount_out"].as_str().unwrap().parse()?;
    // $50 at $60k = 83_333 sats, less 0.3% fee and a little impact
    assert!((82_000..83_334).contains(&out), "out {out}");
    let (bal, _) = e.ledger(&p.vault).await?;
    assert_eq!(bal, [550 * D, out]);
    e.ledger_matches_chain(&p.vault).await?;
    let s = e.state(&p.vault).await?;
    assert!(s["op"].is_null() && budget_used(&s) == 50 * D, "{s}");
    Ok(())
}

#[tokio::test]
async fn trade_below_oracle_floor_is_refused() -> anyhow::Result<()> {
    let (e, p, _, t, _) = trading().await?;
    // rigged pool prices btc at $70k: 14% worse than the oracle, far past the 2% floor
    let rigged = e.pool(100_000 * D, 100_000 * 100_000_000 / 70_000).await?;
    let r = e.trade(&t, &p.vault, rigged, &e.usdc, &e.btc, 50 * D, 0).await?;
    assert!(logs(&r).contains("swap failed") && !logs(&r).contains(r#""event":"trade""#), "{r:?}");
    assert_eq!(e.ledger(&p.vault).await?.0, [600 * D, 0]);
    e.ledger_matches_chain(&p.vault).await?;
    let s = e.state(&p.vault).await?;
    assert!(s["op"].is_null() && budget_used(&s) == 0, "{s}");
    Ok(())
}

#[tokio::test]
async fn trade_caps_enforced() -> anyhow::Result<()> {
    let (e, p, [a, b, _], t, pool) = trading().await?;
    let r = e.trade(&t, &p.vault, pool, &e.usdc, &e.btc, 101 * D, 0).await?;
    assert!(logs(&r).contains("trade refused: over max per trade"), "{r:?}");
    assert!(e.state(&p.vault).await?["op"].is_null());
    let caps = json!({"budget": (120 * D).to_string(), "max_per_trade": (100 * D).to_string()});
    assert_eq!(e.dao_call(&p.dao, &[&a, &b], &p.vault, "set_cap", caps).await?, "Approved");
    ok(e.trade(&t, &p.vault, pool, &e.usdc, &e.btc, 100 * D, 0).await?)?;
    let r = e.trade(&t, &p.vault, pool, &e.usdc, &e.btc, 21 * D, 0).await?;
    assert!(logs(&r).contains("trade refused: over budget"), "{r:?}");
    let s = e.state(&p.vault).await?;
    assert!(s["op"].is_null() && budget_used(&s) == 100 * D, "{s}");
    e.ledger_matches_chain(&p.vault).await?;
    Ok(())
}

#[tokio::test]
async fn stop_loss_trade_pauses_then_dao_resumes() -> anyhow::Result<()> {
    let (e, p, [a, b, _], t, pool) = trading().await?;
    let r = e.trade(&a, &p.vault, pool, &e.usdc, &e.btc, 10 * D, 0).await?;
    assert!(r.is_failure() && format!("{r:?}").contains("only trader"), "{r:?}");
    // tUSDC crashes to $0.40: vault is 60% under its mark, past the 50% stop
    e.prices(4_000).await?;
    let r = e.trade(&t, &p.vault, pool, &e.usdc, &e.btc, 10 * D, 0).await?;
    let l = logs(&r);
    assert!(l.contains(r#""event":"trade""#) && l.contains(r#""reason":"stop_loss""#), "{r:?}");
    assert_eq!(e.state(&p.vault).await?["trader"]["paused"], json!(true));
    let r = e.trade(&t, &p.vault, pool, &e.usdc, &e.btc, 10 * D, 0).await?;
    assert!(r.is_failure() && format!("{r:?}").contains("trader paused"), "{r:?}");
    assert_eq!(e.dao_call(&p.dao, &[&a, &b], &p.vault, "resume", json!({})).await?, "Approved");
    let s = e.state(&p.vault).await?;
    assert!(s["trader"]["paused"] == json!(false) && s["op"].is_null(), "{s}");
    e.ledger_matches_chain(&p.vault).await?;
    Ok(())
}

#[tokio::test]
async fn failed_dex_withdraw_parks_funds_then_recover() -> anyhow::Result<()> {
    let (e, p, [a, b, _], t, pool) = trading().await?;
    // tBTC refuses transfers to the vault (like a usdc blacklist): ref keeps the output for us
    ok(e.root.call(e.btc.id(), "set_blocked").args_json(json!({"account": p.vault})).transact().await?)?;
    let r = e.trade(&t, &p.vault, pool, &e.usdc, &e.btc, 50 * D, 0).await?;
    assert!(logs(&r).contains("dex withdraw failed"), "{r:?}");
    let (bal, at_dex) = e.ledger(&p.vault).await?;
    assert!(bal == [550 * D, 0] && at_dex[0] == 0 && at_dex[1] > 82_000, "{bal:?} {at_dex:?}");
    let deps = e.view(e.dex.id(), "get_deposits", json!({"account_id": p.vault})).await?;
    assert_eq!(deps[e.btc.id().as_str()], json!(at_dex[1].to_string()));
    assert!(e.state(&p.vault).await?["op"].is_null());
    // parked value still counts: a fresh deposit gets ~1 share per $1
    ok(e.deposit(&b, &p.vault, 10, "").await?)?;
    assert!(e.shares(&p.vault, b.id()).await?.abs_diff(210 * D) < D / 100);
    let r = a.call(&p.vault, "leave").args_json(json!({"shares": D.to_string()})).gas(TGAS300).transact().await?;
    assert!(r.is_failure() && format!("{r:?}").contains("funds at dex"), "{r:?}");

    ok(e.root.call(e.btc.id(), "set_blocked").args_json(json!({"account": null})).transact().await?)?;
    ok(b.call(&p.vault, "dex_recover").args_json(json!({"token": e.btc.id()})).gas(TGAS300).transact().await?)?;
    assert_eq!(e.ledger(&p.vault).await?.0, [560 * D, at_dex[1]]);
    e.ledger_matches_chain(&p.vault).await?;
    ok(a.call(&p.vault, "leave").args_json(json!({"shares": D.to_string()})).gas(TGAS300).transact().await?)?;
    Ok(())
}

#[tokio::test]
async fn failed_member_sync_retried_with_bond() -> anyhow::Result<()> {
    let (e, p, _) = funded().await?;
    // dao can't pay for its own storage: add_proposal fails, sync stays pending
    let low = near_workspaces::types::NearToken::from_near(1);
    e.worker.patch(&p.dao).account_from_current(move |a| near_workspaces::types::AccountDetailsPatch::from(a).balance(low)).transact().await?;
    let d = e.user("d", 100).await?;
    let r = e.deposit(&d, &p.vault, 50, "").await?;
    assert!(logs(&r).contains("member sync: propose failed"), "{r:?}");
    assert_eq!(e.view(&p.vault, "get_pending_sync", json!({})).await?, json!([d.id()]));
    assert!(!e.dao_members(&p.dao).await?.contains(&d.id().to_string()));

    ok(e.root.transfer_near(&p.dao, near_workspaces::types::NearToken::from_near(10)).await?.into())?;
    let retry = |bond| d.call(&p.vault, "sync_member").args_json(json!({"account": d.id()})).deposit(bond).gas(TGAS300).transact();
    let r = retry(near_workspaces::types::NearToken::from_yoctonear(0)).await?;
    assert!(r.is_failure() && format!("{r:?}").contains("attach dao bond"), "{r:?}");
    ok(retry(BOND.saturating_add(DAO_STORAGE)).await?)?;
    assert!(e.dao_members(&p.dao).await?.contains(&d.id().to_string()));
    assert_eq!(e.view(&p.vault, "get_pending_sync", json!({})).await?, json!([]));
    Ok(())
}
