//! Sputnik v2 `new` args. Only the vault edits membership; nobody can touch policy, code or funds.
use near_sdk::json_types::{Base64VecU8, U128};
use near_sdk::serde_json::{json, Value};
use near_sdk::AccountId;

const DAY_NS: u64 = 86_400_000_000_000;

/// `nonce` goes in config.metadata so we can tell our dao from a squatter's.
pub fn dao_args(name: &str, vault: &AccountId, bond: U128, nonce: &Base64VecU8) -> Value {
    json!({
        "config": {"name": name, "purpose": "pakt", "metadata": nonce},
        "policy": {
            "roles": [
                {
                    "name": "vault",
                    "kind": {"Group": [vault]},
                    "permissions": [
                        "add_member_to_role:AddProposal",
                        "add_member_to_role:VoteApprove",
                        "add_member_to_role:Finalize",
                        "remove_member_from_role:AddProposal",
                        "remove_member_from_role:VoteApprove",
                        "remove_member_from_role:Finalize",
                    ],
                    "vote_policy": {},
                },
                {
                    "name": "members",
                    "kind": {"Group": []},
                    "permissions": ["call:AddProposal", "call:VoteApprove", "call:VoteReject", "call:VoteRemove", "call:Finalize"],
                    "vote_policy": {},
                },
            ],
            "default_vote_policy": {"weight_kind": "RoleWeight", "quorum": "0", "threshold": [1, 2]},
            "proposal_bond": bond,
            "proposal_period": DAY_NS.to_string(),
            "bounty_bond": bond,
            "bounty_forgiveness_period": DAY_NS.to_string(),
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_vault_syncs_members_and_members_only_call() {
        let a = dao_args("x", &"x.pakt.testnet".parse().unwrap(), U128(1), &vec![1].into());
        let roles = a["policy"]["roles"].as_array().unwrap();
        assert_eq!(roles.len(), 2);
        for r in roles {
            let allowed: &[&str] = if r["name"] == "vault" {
                &["add_member_to_role", "remove_member_from_role"]
            } else {
                assert_eq!(r["name"], "members");
                assert_eq!(r["kind"]["Group"], json!([]));
                &["call"]
            };
            for p in r["permissions"].as_array().unwrap() {
                let (kind, action) = p.as_str().unwrap().split_once(':').unwrap();
                assert!(allowed.contains(&kind) && action != "*", "forbidden {p}");
            }
        }
        assert_eq!(roles[0]["kind"]["Group"], json!(["x.pakt.testnet"]));
        assert!(roles[1]["permissions"].as_array().unwrap().contains(&json!("call:Finalize")));
        let vault = roles[0]["permissions"].as_array().unwrap();
        assert!(vault.contains(&json!("add_member_to_role:Finalize")) && vault.contains(&json!("remove_member_from_role:Finalize")));
    }
}
