use near_sdk::{env, require, AccountId};

/// `<name>.<factory>` vault and `<name>.<sputnik>` dao; panics on a bad name.
pub fn ids(name: &str, factory: &AccountId, sputnik: &AccountId) -> (AccountId, AccountId) {
    require!(
        (2..=32).contains(&name.len())
            && name.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-' || b == b'_'),
        "name: 2-32 chars of a-z 0-9 - _"
    );
    // charset alone lets through `a--b`, `-a` and over-long ids
    let sub = |p: &AccountId| format!("{name}.{p}").parse().unwrap_or_else(|_| env::panic_str("name: not a valid account"));
    (sub(factory), sub(sputnik))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn acc(s: &str) -> AccountId {
        s.parse().unwrap()
    }

    #[test]
    fn builds_both_ids() {
        let (v, d) = ids("moon-club", &acc("pakt.testnet"), &acc("sputnikv2.testnet"));
        assert_eq!(v.as_str(), "moon-club.pakt.testnet");
        assert_eq!(d.as_str(), "moon-club.sputnikv2.testnet");
    }

    #[test]
    fn rejects_bad_names() {
        for bad in ["a", "Moon", "moon.club", "moon club", "a--b", "-ab", &"a".repeat(33)] {
            let r = std::panic::catch_unwind(|| ids(bad, &acc("pakt.testnet"), &acc("sputnikv2.testnet")));
            assert!(r.is_err(), "{bad} accepted");
        }
    }
}
