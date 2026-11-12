//! Sandbox: real sputnik v2 factory + real ref exchange; create_pakt wires vault + dao + ref account, squatted names refund.
use near_workspaces::types::{Gas, NearToken};
use near_workspaces::Account;
use serde_json::{json, Value};

const TGAS300: Gas = Gas::from_tgas(300);

fn wasm(path: &str) -> Vec<u8> {
    let p = format!("{}/../res/{path}", env!("CARGO_MANIFEST_DIR"));
    std::fs::read(&p).unwrap_or_else(|_| panic!("missing {p}, run scripts/build-contracts.sh"))
}

async fn sub(root: &Account, name: &str, near: u128) -> anyhow::Result<Account> {
    Ok(root.create_subaccount(name).initial_balance(NearToken::from_near(near)).transact().await?.into_result()?)
}

#[tokio::test]
async fn create_pakt_end_to_end() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let root = worker.root_account()?;
    let sputnik = sub(&root, "sputnik", 100).await?.deploy(&wasm("external/sputnik_factory.wasm")).await?.into_result()?;
    assert!(sputnik.call("new").gas(TGAS300).transact().await?.is_success());
    let usdc = sub(&root, "usdc", 10).await?.deploy(&wasm("pakt_mock_ft.wasm")).await?.into_result()?;
    let r = usdc.call("new").args_json(json!({"owner": root.id(), "name": "t", "symbol": "t", "decimals": 6})).transact().await?;
    assert!(r.is_success(), "{r:?}");
    // real ref-finance-101.testnet code (v1.9.19)
    let dex = sub(&root, "ref", 30).await?.deploy(&wasm("external/ref_exchange.wasm")).await?.into_result()?;
    let r = dex.call("new").args_json(json!({"owner_id": root.id(), "boost_farm_id": root.id(), "burrowland_id": root.id(), "exchange_fee": 0, "referral_fee": 0})).transact().await?;
    assert!(r.is_success(), "{r:?}");
    let factory = sub(&root, "pakt", 30).await?.deploy(&wasm("pakt_factory.wasm")).await?.into_result()?;
    let r = factory
        .call("new")
        .args_json(json!({"owner": root.id(), "config": {"oracle": root.id(), "platform": root.id(), "sputnik_factory": sputnik.id(),
            "dao_bond": "100000000000000000000000", "tokens": [usdc.id()], "base_tokens": [usdc.id()], "dex": dex.id(), "settle_period_ms": 60_000, "trade_delay_ms": 60_000}}))
        .transact()
        .await?;
    assert!(r.is_success(), "{r:?}");
    let alice = sub(&root, "alice", 100).await?;
    let need: NearToken = factory.view("required_deposit").args_json(json!({"whitelist_len": 1})).await?.json()?;
    let create = |name: &str| {
        alice
            .call(factory.id(), "create_pakt")
            .args_json(json!({"name": name, "whitelist": [usdc.id()], "stop_loss_bps": 2500, "join_mode": "Open", "invite_key": null, "min_deposit": "5000000"}))
            .deposit(need)
            .gas(TGAS300)
    };

    let r = create("moon").transact().await?;
    assert!(r.is_success(), "{r:?}");
    assert!(r.logs().iter().any(|l| l.contains("pakt_created")), "{:?}", r.logs());
    println!("create_pakt burnt {}", r.total_gas_burnt);
    let p: Value = factory.view("get_pakt").args_json(json!({"name": "moon"})).await?.json()?;
    let vault: near_workspaces::AccountId = p["vault"].as_str().unwrap().parse()?;
    let dao: near_workspaces::AccountId = p["dao"].as_str().unwrap().parse()?;
    assert_eq!(dao.as_str(), format!("moon.{}", sputnik.id()));
    assert!(worker.view_access_keys(&vault).await?.is_empty(), "vault must have no keys");
    let st: Value = worker.view(&vault, "get_state").await?.json()?;
    assert_eq!(st["dao"], json!(dao));
    assert_eq!((st["dex"].clone(), st["settle_period_ms"].clone(), st["trade_delay_ms"].clone()), (json!(dex.id()), json!(60_000), json!(60_000)));
    // vault init opened its ref account with every whitelist token registered
    let deps: Value = dex.view("get_deposits").args_json(json!({"account_id": vault})).await?.json()?;
    assert_eq!(deps, json!({usdc.id().as_str(): "0"}), "vault not registered at ref");
    let reg: Value = usdc.view("storage_balance_of").args_json(json!({"account_id": vault})).await?.json()?;
    assert!(!reg.is_null(), "vault not registered on usdc");
    let pol: Value = worker.view(&dao, "get_policy").await?.json()?;
    assert_eq!(pol["roles"][0]["kind"]["Group"], json!([vault]));

    // no role but vault may touch membership; vault-driven sync is covered by e2e
    let kind = json!({"AddMemberToRole": {"member_id": alice.id(), "role": "members"}});
    let r = alice.call(&dao, "add_proposal").args_json(json!({"proposal": {"description": "x", "kind": kind}})).deposit(NearToken::from_millinear(100)).transact().await?;
    assert!(r.is_failure(), "outsider must not propose");

    assert!(create("moon").transact().await?.is_failure(), "dup name");

    // squatter owns the dao name: pakt must not be made, payer refunded
    let squat_args = near_sdk::json_types::Base64VecU8::from(json!({"config": {"name": "sun", "purpose": "", "metadata": ""}, "policy": [alice.id()]}).to_string().into_bytes());
    let r = alice.call(sputnik.id(), "create").args_json(json!({"name": "sun", "args": squat_args})).deposit(NearToken::from_near(6)).gas(TGAS300).transact().await?;
    assert!(r.is_success(), "{r:?}");
    let before = alice.view_account().await?.balance;
    let r = create("sun").transact().await?;
    let after = alice.view_account().await?.balance;
    assert!(r.logs().iter().all(|l| !l.contains("pakt_created")), "{:?}", r.logs());
    assert!(factory.view("get_pakt").args_json(json!({"name": "sun"})).await?.json::<Value>()?.is_null());
    assert!(before.saturating_sub(after) < NearToken::from_millinear(100), "lost {}", before.saturating_sub(after));
    println!("required_deposit(1) = {need}");
    Ok(())
}
