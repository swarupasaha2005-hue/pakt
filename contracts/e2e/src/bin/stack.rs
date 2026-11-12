//! Sandbox for the backend stack test (backend/scripts/stack-e2e.ts drives it).
//! Prints `STACK rpc=.. factory=..` once up, runs one pakt through every event kind, prints
//! `STACK ready {json}`, then per stdin line `live` deposits $10 as c and prints `STACK ok`. EOF stops it.
//! Arg `smoke`: only the pakt and a's deposit.
use std::io::{BufRead, Write};

use near_workspaces::types::NearToken;
use near_workspaces::Account;
use pakt_e2e::*;
use serde_json::json;

fn say(s: String) {
    println!("STACK {s}");
    std::io::stdout().flush().unwrap();
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let e = setup().await?;
    say(format!("rpc={} factory={}", e.worker.rpc_addr(), e.factory.id()));
    let [a, b, c] = [e.user("a", 1000).await?, e.user("b", 1000).await?, e.user("c", 1000).await?];
    let x = e.user("x", 0).await?;
    // t never registers on tUSDC up front, so its leave payout parks and claim has work
    let t = e.root.create_subaccount("t").initial_balance(NearToken::from_near(10)).transact().await?.into_result()?;

    let smoke = std::env::args().any(|a| a == "smoke");
    let p = e.create_pakt(&a, "moon", None).await?;
    for (who, usd) in [(&a, 100), (&b, 200), (&c, 300)].into_iter().take(if smoke { 1 } else { 3 }) {
        ok(e.deposit(who, &p.vault, usd, "").await?)?;
    }
    if !smoke {
        full(&e, &p, [&a, &b, &c, &x, &t]).await?;
    }
    let ids = json!({"vault": p.vault, "dao": p.dao, "usdc": e.usdc.id(), "a": a.id(), "b": b.id(), "c": c.id(), "t": t.id(), "x": x.id()});
    say(format!("ready {ids}"));
    for line in std::io::stdin().lock().lines() {
        if line? == "live" {
            ok(e.deposit(&c, &p.vault, 10, "").await?)?;
            say("ok".into());
        }
    }
    Ok(())
}

/// offer, decline, hire, cap, trade, profit settle, stop-loss pause, resume, fire, leaves, parked payout claim
async fn full(e: &Env, p: &Pakt, [a, b, c, x, t]: [&Account; 5]) -> anyhow::Result<()> {
    let voters = [a, c];
    let offer = |who: &Account| {
        json!({"account": who.id(), "budget": (500 * USDC).to_string(), "max_per_trade": (100 * USDC).to_string(),
               "fee_bps": 2000, "stop_loss_bps": 5000})
    };
    let approved = |s: String| -> anyhow::Result<()> {
        anyhow::ensure!(s == "Approved", "proposal {s}");
        Ok(())
    };
    approved(e.dao_call(&p.dao, &voters, &p.vault, "offer_trader", offer(x)).await?)?;
    ok(x.call(&p.vault, "decline_offer").transact().await?)?;
    approved(e.dao_call(&p.dao, &voters, &p.vault, "offer_trader", offer(t)).await?)?;
    ok(t.call(&p.vault, "accept_offer").gas(TGAS300).transact().await?)?;
    let caps = json!({"budget": (400 * USDC).to_string(), "max_per_trade": (50 * USDC).to_string()});
    approved(e.dao_call(&p.dao, &voters, &p.vault, "set_cap", caps).await?)?;

    let pool = e.fair_pool().await?;
    e.wait_trade(&p.vault).await?;
    ok(e.trade(t, &p.vault, pool, &e.usdc, &e.btc, 50 * USDC, 0).await?)?;

    // tUSDC +20% then settle: profit for t
    e.prices(12_000).await?;
    e.wait_settle(&p.vault).await?;
    ok(e.root.call(&p.vault, "settle").gas(TGAS300).transact().await?)?;
    // crash below the 50% stop: b's leave marks the vault and pauses t
    e.prices(5_000).await?;
    let all = e.shares(&p.vault, b.id()).await?;
    ok(b.call(&p.vault, "leave").args_json(json!({"shares": all.to_string()})).gas(TGAS300).transact().await?)?;
    e.prices(12_000).await?;
    approved(e.dao_call(&p.dao, &voters, &p.vault, "resume", json!({})).await?)?;
    approved(e.dao_call(&p.dao, &voters, &p.vault, "fire", json!({})).await?)?;

    let fee = e.shares(&p.vault, t.id()).await?;
    ok(t.call(&p.vault, "leave").args_json(json!({"shares": fee.to_string()})).gas(TGAS300).transact().await?)?;
    ok(t.call(e.usdc.id(), "storage_deposit").args_json(json!({})).deposit(NearToken::from_millinear(10)).transact().await?)?;
    ok(t.call(&p.vault, "claim").args_json(json!({"token": e.usdc.id()})).gas(TGAS300).transact().await?)?;
    Ok(())
}
