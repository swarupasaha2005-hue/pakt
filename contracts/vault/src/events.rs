//! NEP-297 logs (`standard: pakt`) + last-50 ring buffer for the feed.
use near_sdk::serde_json::{json, Value};
use near_sdk::{env, near};

use crate::{Vault, VaultExt};

pub const RING: u64 = 50;

impl Vault {
    pub(crate) fn emit(&mut self, event: &str, data: Value) {
        let line = json!({"standard": "pakt", "version": "1.0.0", "event": event, "data": [data]}).to_string();
        env::log_str(&format!("EVENT_JSON:{line}"));
        let entry = json!({"event": event, "data": data, "at_ms": env::block_timestamp_ms().to_string()}).to_string();
        self.events.insert((self.event_count % RING) as u32, entry);
        self.event_count += 1;
    }
}

#[near]
impl Vault {
    /// newest first, max 50
    pub fn get_events(&self, limit: Option<u64>) -> Vec<Value> {
        let n = limit.unwrap_or(RING).min(RING).min(self.event_count);
        (1..=n)
            .filter_map(|i| self.events.get(&(((self.event_count - i) % RING) as u32)))
            .filter_map(|s| near_sdk::serde_json::from_str(s).ok())
            .collect()
    }
}
