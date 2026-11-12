//! e2e helpers: sandbox with real burrow oracle, real sputnik, real ref exchange, mock fts, pakt factory.
use base64::Engine;
use ed25519_dalek::{Signer, SigningKey};
use near_workspaces::network::Sandbox;
use near_workspaces::result::ExecutionFinalResult;
use near_workspaces::types::{Gas, NearToken};
use near_workspaces::{Account, AccountId, Contract, Worker};
use serde_json::{json, Value};

pub const TGAS300: Gas = Gas::from_tgas(300);
pub const USDC: u128 = 1_000_000;
pub const BOND: NearToken = NearToken::from_millinear(100);
pub const SETTLE_MS: u64 = 60_000;
/// factory floor; tests fast_forward past it with wait_trade
pub const TRADE_DELAY_MS: u64 = 60_000;
/// vault sends this to the dao per member sync; sync_member callers attach bond + this
pub const DAO_STORAGE: NearToken = NearToken::from_micronear(3_000);
/// vault storage_deposit for joiners; excess refunded
pub const STORAGE_FEE: NearToken = NearToken::from_millinear(10);
/// tBTC sats per $1 at the pinned $60k
pub const SATS_PER_USD: u128 = 100_000_000 / 60_000;
const ONE: NearToken = NearToken::from_yoctonear(1);

fn wasm(path: &str) -> Vec<u8> {
    let p = format!("{}/../res/{path}", env!("CARGO_MANIFEST_DIR"));
    std::fs::read(&p).unwrap_or_else(|_| panic!("missing {p}, run scripts/build-contracts.sh"))
}

pub fn ok(r: ExecutionFinalResult) -> anyhow::Result<()> {
    anyhow::ensure!(r.is_success(), "{r:?}");
    Ok(())
}

/// every receipt log of a tx, joined
pub fn logs(r: &ExecutionFinalResult) -> String {
    r.logs().join("\n")
}

async fn sub(root: &Account, name: &str, near: u128) -> anyhow::Result<Account> {
    Ok(root.create_subaccount(name).initial_balance(NearToken::from_near(near)).transact().await?.into_result()?)
}

pub struct Env {
    pub worker: Worker<Sandbox>,
    pub root: Account,
    pub oracle: Contract,
    pub dex: Contract,
    pub factory: Contract,
    pub usdc: Contract,
    pub btc: Contract,
    pub platform: Account,
}

pub struct Pakt {
    pub vault: AccountId,
    pub dao: AccountId,
}

pub async fn setup() -> anyhow::Result<Env> {
    let worker = near_workspaces::sandbox().await?;
    let root = worker.root_account()?;

    // real burrow oracle 0.6.0 (priceoracle.testnet); root is the only reporter
    let oracle = sub(&root, "oracle", 20).await?.deploy(&wasm("external/price_oracle.wasm")).await?.into_result()?;
    ok(oracle.call("new").args_json(json!({"recency_duration_sec": 3600, "owner_id": root.id(), "near_claim_amount": "0"})).transact().await?)?;
    ok(root.call(oracle.id(), "add_oracle").args_json(json!({"account_id": root.id()})).deposit(ONE).transact().await?)?;

    // real sputnikv2.testnet factory; new() stores its embedded dao v3 code
    let sputnik = sub(&root, "sputnik", 100).await?.deploy(&wasm("external/sputnik_factory.wasm")).await?.into_result()?;
    ok(sputnik.call("new").gas(TGAS300).transact().await?)?;

    let ft = wasm("pakt_mock_ft.wasm");
    let mut tokens = vec![];
    for (name, sym, dec) in [("usdc", "tUSDC", 6u8), ("btc", "tBTC", 8)] {
        let t = sub(&root, name, 10).await?.deploy(&ft).await?.into_result()?;
        ok(t.call("new").args_json(json!({"owner": root.id(), "name": sym, "symbol": sym, "decimals": dec})).transact().await?)?;
        ok(root.call(oracle.id(), "add_asset").args_json(json!({"asset_id": t.id()})).deposit(ONE).transact().await?)?;
        tokens.push(t);
    }
    let btc = tokens.pop().unwrap();
    let usdc = tokens.pop().unwrap();

    // real ref-finance-101.testnet code (v1.9.19); root seeds pools as LP
    let dex = sub(&root, "ref", 30).await?.deploy(&wasm("external/ref_exchange.wasm")).await?.into_result()?;
    ok(dex.call("new").args_json(json!({"owner_id": root.id(), "boost_farm_id": root.id(), "burrowland_id": root.id(), "exchange_fee": 0, "referral_fee": 0})).transact().await?)?;
    ok(root.call(dex.id(), "storage_deposit").args_json(json!({})).deposit(NearToken::from_near(1)).transact().await?)?;
    ok(root.call(dex.id(), "register_tokens").args_json(json!({"token_ids": [usdc.id(), btc.id()]})).deposit(ONE).transact().await?)?;
    for t in [&usdc, &btc] {
        ok(root.call(t.id(), "storage_deposit").args_json(json!({"account_id": dex.id()})).deposit(NearToken::from_millinear(10)).transact().await?)?;
    }

    let platform = sub(&root, "platform", 5).await?;
    let factory = sub(&root, "pakt", 200).await?.deploy(&wasm("pakt_factory.wasm")).await?.into_result()?;
    ok(factory
        .call("new")
        .args_json(json!({"owner": root.id(), "config": {"oracle": oracle.id(), "platform": platform.id(),
            "sputnik_factory": sputnik.id(), "dao_bond": BOND.as_yoctonear().to_string(),
            "tokens": [usdc.id(), btc.id()], "base_tokens": [usdc.id()],
            "dex": dex.id(), "settle_period_ms": SETTLE_MS, "trade_delay_ms": TRADE_DELAY_MS}}))
        .transact()
        .await?)?;

    let env = Env { worker, root, oracle, dex, factory, usdc, btc, platform };
    env.prices(10_000).await?;
    Ok(env)
}

impl Env {
    /// tUSDC usd in 4 decimals (burrow style: multiplier e4, decimals = 6 + 4); tBTC pinned at $60k
    pub async fn prices(&self, usdc_e4: u128) -> anyhow::Result<()> {
        let p = |t: &Contract, m: u128, d: u8| json!({"asset_id": t.id(), "price": {"multiplier": m.to_string(), "decimals": d}});
        let prices = json!([p(&self.usdc, usdc_e4, 10), p(&self.btc, 600_000_000, 12)]);
        ok(self.root.call(self.oracle.id(), "report_prices").args_json(json!({"prices": prices})).transact().await?)?;
        Ok(())
    }

    /// make every report stale: oracle answers null prices until recency is restored
    pub async fn stale_prices(&self) -> anyhow::Result<()> {
        ok(self.root.call(self.oracle.id(), "set_recency_duration_sec").args_json(json!({"recency_duration_sec": 1})).deposit(ONE).transact().await?)?;
        self.worker.fast_forward(10).await?;
        Ok(())
    }

    /// new account holding `usd` tUSDC
    pub async fn user(&self, name: &str, usd: u128) -> anyhow::Result<Account> {
        let a = sub(&self.root, name, 30).await?;
        ok(self.root.call(self.usdc.id(), "mint").args_json(json!({"to": a.id(), "amount": (usd * USDC).to_string()})).transact().await?)?;
        Ok(a)
    }

    pub async fn create_pakt(&self, creator: &Account, name: &str, invite_key: Option<String>) -> anyhow::Result<Pakt> {
        let whitelist = [self.usdc.id(), self.btc.id()];
        let need: NearToken = self.factory.view("required_deposit").args_json(json!({"whitelist_len": 2})).await?.json()?;
        let mode = if invite_key.is_some() { "Invite" } else { "Open" };
        let r = creator
            .call(self.factory.id(), "create_pakt")
            .args_json(json!({"name": name, "whitelist": whitelist, "stop_loss_bps": 5000, "join_mode": mode,
                              "invite_key": invite_key, "min_deposit": (5 * USDC).to_string()}))
            .deposit(need)
            .gas(TGAS300)
            .transact()
            .await?;
        anyhow::ensure!(logs(&r).contains("pakt_created"), "pakt not created: {r:?}");
        let p = self.view(self.factory.id(), "get_pakt", json!({"name": name})).await?;
        Ok(Pakt { vault: p["vault"].as_str().unwrap().parse()?, dao: p["dao"].as_str().unwrap().parse()? })
    }

    /// storage_deposit on the vault (tops up, refunds excess), then base-token ft_transfer_call; may end in a refund
    pub async fn deposit(&self, who: &Account, vault: &AccountId, usd: u128, msg: &str) -> anyhow::Result<ExecutionFinalResult> {
        ok(who.call(vault, "storage_deposit").args_json(json!({})).deposit(STORAGE_FEE).transact().await?)?;
        self.ft_call(who, &self.usdc, vault, usd * USDC, msg).await
    }

    pub async fn ft_call(&self, who: &Account, token: &Contract, to: &AccountId, raw: u128, msg: &str) -> anyhow::Result<ExecutionFinalResult> {
        Ok(who
            .call(token.id(), "ft_transfer_call")
            .args_json(json!({"receiver_id": to, "amount": raw.to_string(), "msg": msg}))
            .deposit(ONE)
            .gas(TGAS300)
            .transact()
            .await?)
    }

    pub async fn usdc_of(&self, who: &AccountId) -> anyhow::Result<u128> {
        let s: String = self.usdc.view("ft_balance_of").args_json(json!({"account_id": who})).await?.json()?;
        Ok(s.parse()?)
    }

    pub async fn view(&self, id: &AccountId, method: &str, args: Value) -> anyhow::Result<Value> {
        Ok(self.worker.view(id, method).args_json(args).await?.json()?)
    }

    pub async fn state(&self, vault: &AccountId) -> anyhow::Result<Value> {
        self.view(vault, "get_state", json!({})).await
    }

    /// holder shares, 0 if none
    pub async fn shares(&self, vault: &AccountId, who: &AccountId) -> anyhow::Result<u128> {
        let h = self.view(vault, "get_holder", json!({"account": who})).await?;
        Ok(h["shares"].as_str().map_or(0, |s| s.parse().unwrap()))
    }

    /// usd e6 of `who`'s shares at tUSDC price `usdc_e4` (vault holds only tUSDC)
    pub async fn worth(&self, vault: &AccountId, who: &AccountId, usdc_e4: u128) -> anyhow::Result<u128> {
        let s = self.state(vault).await?;
        let bal: u128 = s["balances"][0][1].as_str().unwrap().parse()?;
        let total: u128 = s["total_shares"].as_str().unwrap().parse()?;
        Ok(self.shares(vault, who).await? * bal * usdc_e4 / 10_000 / total)
    }

    /// accounts in the dao `members` role
    pub async fn dao_members(&self, dao: &AccountId) -> anyhow::Result<Vec<String>> {
        let p = self.view(dao, "get_policy", json!({})).await?;
        let r = p["roles"].as_array().unwrap().iter().find(|r| r["name"] == "members").unwrap();
        Ok(serde_json::from_value(r["kind"]["Group"].clone())?)
    }

    /// add_proposal with the dao bond; Err if the dao refuses it
    pub async fn propose(&self, dao: &AccountId, who: &Account, kind: Value) -> anyhow::Result<u64> {
        let r = who
            .call(dao, "add_proposal")
            .args_json(json!({"proposal": {"description": "e2e", "kind": kind}}))
            .deposit(BOND)
            .gas(TGAS300)
            .transact()
            .await?
            .into_result()?;
        Ok(r.json()?)
    }

    /// VoteApprove by each voter; returns the proposal status after the last vote
    pub async fn approve(&self, dao: &AccountId, id: u64, voters: &[&Account]) -> anyhow::Result<String> {
        let kind = self.view(dao, "get_proposal", json!({"id": id})).await?["kind"].clone();
        for v in voters {
            ok(v.call(dao, "act_proposal")
                .args_json(json!({"id": id, "action": "VoteApprove", "proposal": kind}))
                .gas(TGAS300)
                .transact()
                .await?)?;
        }
        Ok(self.view(dao, "get_proposal", json!({"id": id})).await?["status"].as_str().unwrap().to_string())
    }

    /// real sputnik vote: voters[0] proposes `receiver.method(args)`, all approve; returns status
    pub async fn dao_call(&self, dao: &AccountId, voters: &[&Account], receiver: &AccountId, method: &str, args: Value) -> anyhow::Result<String> {
        let args = base64::engine::general_purpose::STANDARD.encode(args.to_string());
        // vault async ops demand 250 TGas prepaid
        let kind = json!({"FunctionCall": {"receiver_id": receiver, "actions": [
            {"method_name": method, "args": args, "deposit": "0", "gas": Gas::from_tgas(250).as_gas().to_string()}]}});
        let id = self.propose(dao, voters[0], kind).await?;
        self.approve(dao, id, voters).await
    }

    /// fast_forward until the vault's settle period has passed
    pub async fn wait_settle(&self, vault: &AccountId) -> anyhow::Result<()> {
        let s = self.state(vault).await?;
        let due = s["last_settle_ms"].as_u64().unwrap() + s["settle_period_ms"].as_u64().unwrap();
        while self.worker.view_block().await?.timestamp() / 1_000_000 <= due {
            self.worker.fast_forward(100).await?;
        }
        Ok(())
    }

    /// fast_forward until the hired trader's delay has passed
    pub async fn wait_trade(&self, vault: &AccountId) -> anyhow::Result<()> {
        let due = self.state(vault).await?["trade_after_ms"].as_u64().unwrap();
        while self.worker.view_block().await?.timestamp() / 1_000_000 < due {
            self.worker.fast_forward(100).await?;
        }
        Ok(())
    }

    /// new ref simple pool (0.3% fee) seeded by root; returns pool id
    pub async fn pool(&self, usdc_raw: u128, btc_raw: u128) -> anyhow::Result<u64> {
        let id: u64 = self
            .root
            .call(self.dex.id(), "add_simple_pool")
            .args_json(json!({"tokens": [self.usdc.id(), self.btc.id()], "fee": 30}))
            .deposit(NearToken::from_millinear(100))
            .transact()
            .await?
            .into_result()?
            .json()?;
        for (t, raw) in [(&self.usdc, usdc_raw), (&self.btc, btc_raw)] {
            ok(self.root.call(t.id(), "mint").args_json(json!({"to": self.root.id(), "amount": raw.to_string()})).transact().await?)?;
            ok(self.ft_call(&self.root, t, self.dex.id(), raw, "").await?)?;
        }
        let amounts = json!([usdc_raw.to_string(), btc_raw.to_string()]);
        ok(self.root.call(self.dex.id(), "add_liquidity").args_json(json!({"pool_id": id, "amounts": amounts})).deposit(NearToken::from_millinear(100)).transact().await?)?;
        Ok(id)
    }

    /// pool priced at the oracle: $100k a side
    pub async fn fair_pool(&self) -> anyhow::Result<u64> {
        self.pool(100_000 * USDC, 100_000 * SATS_PER_USD).await
    }

    pub async fn trade(&self, who: &Account, vault: &AccountId, pool: u64, from: &Contract, to: &Contract, raw: u128, min_out: u128) -> anyhow::Result<ExecutionFinalResult> {
        Ok(who
            .call(vault, "trade")
            .args_json(json!({"pool_id": pool, "token_in": from.id(), "token_out": to.id(), "amount_in": raw.to_string(), "min_out": min_out.to_string()}))
            .gas(TGAS300)
            .transact()
            .await?)
    }

    pub async fn ft_of(&self, token: &Contract, who: &AccountId) -> anyhow::Result<u128> {
        let s: String = token.view("ft_balance_of").args_json(json!({"account_id": who})).await?.json()?;
        Ok(s.parse()?)
    }

    /// vault ledger [usdc, btc] and at_dex [usdc, btc]
    pub async fn ledger(&self, vault: &AccountId) -> anyhow::Result<([u128; 2], [u128; 2])> {
        let s = self.state(vault).await?;
        let n = |k: &str, i: usize| s[k][i][1].as_str().unwrap().parse::<u128>().unwrap();
        Ok(([n("balances", 0), n("balances", 1)], [n("at_dex", 0), n("at_dex", 1)]))
    }

    /// internal ledger equals what the tokens say the vault holds, nothing left at ref
    pub async fn ledger_matches_chain(&self, vault: &AccountId) -> anyhow::Result<()> {
        let (bal, at_dex) = self.ledger(vault).await?;
        let chain = [self.ft_of(&self.usdc, vault).await?, self.ft_of(&self.btc, vault).await?];
        anyhow::ensure!(bal == chain && at_dex == [0, 0], "ledger {bal:?} at_dex {at_dex:?} vs chain {chain:?}");
        Ok(())
    }
}

pub fn invite_key(seed: u8) -> String {
    hex(SigningKey::from_bytes(&[seed; 32]).verifying_key().as_bytes())
}

/// deposit msg with the invite sig over "pakt-invite:<vault>:<joiner>"
pub fn invite_msg(seed: u8, vault: &AccountId, joiner: &AccountId) -> String {
    let sig = SigningKey::from_bytes(&[seed; 32]).sign(format!("pakt-invite:{vault}:{joiner}").as_bytes());
    json!({"invite_sig": hex(&sig.to_bytes())}).to_string()
}

fn hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}
