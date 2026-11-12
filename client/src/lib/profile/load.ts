// Everything the profile page shows for one account, from the backend and chain views.
import { accountFeed, pakts, trader, type PaktEvent, type TraderRecord } from "../api";
import { RPC_URL, TOKENS, type TokenInfo } from "../config";
import { ftBalanceOf, getHolder, getPrices, getState, sharesValue, usdE6, vaultValue } from "../near/contracts";
import { e6, paktName } from "./format";

export type Cash = { token: TokenInfo; raw: string; usd: number | null };
/** value null when a held token has no oracle price */
export type Position = { vault: string; name: string; shares: string; member: boolean; joinedMs: number; value: number | null; pct: number };
export type ProfileData = { cash: Cash[]; positions: Position[]; events: PaktEvent[]; trader: TraderRecord | null };

/** false only for UNKNOWN_ACCOUNT; other rpc errors throw */
async function accountExists(account: string) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "pakt", method: "query", params: { request_type: "view_account", finality: "final", account_id: account } }),
  });
  const r = await res.json();
  if (!r.error) return true;
  if (r.error.cause?.name === "UNKNOWN_ACCOUNT") return false;
  throw new Error(`view_account ${account}: ${r.error.data ?? r.error.message}`);
}

async function allVaults() {
  const out: string[] = [];
  for (let before: number | undefined, i = 0; i < 20; i++) {
    const page = await pakts({ limit: 100, before });
    out.push(...page.items.map((p) => p.vault));
    if (page.next === null) break;
    before = page.next;
  }
  return out;
}

/** null = no such account on chain */
export async function loadProfile(account: string): Promise<ProfileData | null> {
  if (!(await accountExists(account))) return null;
  const ids = TOKENS.map((t) => t.id);
  const [prices, balances, vaults, feed, record] = await Promise.all([
    getPrices(ids),
    Promise.all(ids.map((id) => ftBalanceOf(id, account))),
    allVaults(),
    accountFeed(account, { limit: 50 }),
    trader(account),
  ]);

  const cash = TOKENS.map((t, i) => {
    const v = usdE6(prices, t.id, balances[i]);
    return { token: t, raw: balances[i], usd: v === null ? null : e6(v) };
  });

  const held = await Promise.all(
    vaults.map(async (vault): Promise<Position | null> => {
      const h = await getHolder(vault, account);
      if (!h || h.shares === "0") return null;
      const s = await getState(vault);
      const total = vaultValue(s, prices);
      return {
        vault, name: paktName(vault), shares: h.shares, member: h.member, joinedMs: h.joined_ms,
        value: total === null ? null : e6(sharesValue(h.shares, s, total)),
        pct: s.total_shares === "0" ? 0 : (Number(h.shares) / Number(s.total_shares)) * 100,
      };
    }),
  );

  return {
    cash,
    positions: held.filter((p) => p !== null).toSorted((a, b) => b.joinedMs - a.joinedMs),
    events: feed.items,
    // never hired = no tenures; hide the trader section
    trader: record.pakts.length ? record : null,
  };
}
