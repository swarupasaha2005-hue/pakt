//! 256-bit intermediates so `a * b / c` never overflows on 24-decimal balances.
uint::construct_uint! {
    pub struct U256(4);
}

/// floor(a * b / c); c == 0 → 0
pub fn mul_div(a: u128, b: u128, c: u128) -> u128 {
    if c == 0 {
        return 0;
    }
    (U256::from(a) * U256::from(b) / U256::from(c)).low_u128()
}

/// raw token amount → usd, 6 decimals. oracle price: usd = raw * multiplier / 10^decimals
pub fn usd_e6(raw: u128, multiplier: u128, decimals: u8) -> u128 {
    let v = U256::from(raw) * U256::from(multiplier) * U256::from(1_000_000u64) / U256::exp10(decimals as usize);
    v.low_u128()
}

/// inverse of usd_e6; multiplier must be > 0
pub fn raw_from_usd_e6(usd: u128, multiplier: u128, decimals: u8) -> u128 {
    (U256::from(usd) * U256::exp10(decimals as usize) / (U256::from(multiplier) * U256::from(1_000_000u64))).low_u128()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn no_overflow_on_big_balances() {
        // 1M wNEAR (24 dec) * 1e15 shares / 1e15
        assert_eq!(mul_div(10u128.pow(30), 10u128.pow(15), 10u128.pow(15)), 10u128.pow(30));
        assert_eq!(mul_div(7, 3, 2), 10);
        assert_eq!(mul_div(1, 1, 0), 0);
    }

    #[test]
    fn usd_from_oracle_price() {
        // 1 DAI (18 dec) at multiplier 9992, decimals 22 → $0.9992
        assert_eq!(usd_e6(10u128.pow(18), 9992, 22), 999_200);
        // 5 USDC (6 dec) at multiplier 10000, decimals 10 → $5
        assert_eq!(usd_e6(5_000_000, 10_000, 10), 5_000_000);
        // $60 of btc (8 dec) at $60k → 0.001 btc
        assert_eq!(raw_from_usd_e6(60_000_000, 600_000_000, 12), 100_000);
    }
}
