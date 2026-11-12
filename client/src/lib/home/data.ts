"use client";

// Shared loaders for shell, home and left panel: tokens at oracle prices, pakts joined with vault state, user holdings.
import { useEffect, useState, useSyncExternalStore } from "react";
import { pakts, type JoinMode } from "../api";
import { BASE_TOKEN, TOKENS, token, type TokenInfo } from "../config";
import { ftBalanceOf, getHolder, getPrices, getState, sharesValue, usdE6, vaultValue, type PriceData, type Trader, type VaultState } from "../near/contracts";

/** static logos by symbol; tokens have no on-chain logo */
export const LOGOS: Record<string, string> = { tUSDC: "/tokens/usdc.svg", tBTC: "/tokens/wbtc.svg", tNEAR: "/tokens/near.jpg" };

/** usd e6 string or bigint → number */
export const usdNum = (e6: string | bigint) => Number(e6) / 1e6;
/** vault id → pakt name (first label) */
export const paktName = (vault: string) => vault.split(".")[0];

// shortcut: 30s in-memory cache per key so many widgets share one fetch; upgrade to swr if pages grow
const cache = new Map<string, { at: number; p: Promise<unknown> }>();
function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 30_000) return hit.p as Promise<T>;
  const p = fn();
  cache.set(key, { at: Date.now(), p });
  p.catch(() => cache.delete(key));
  return p;
}

export const prices = () => cached("prices", () => getPrices(TOKENS.map((t) => t.id)));

export type TokenPrice = TokenInfo & { logo?: string; price: number | null };
export const loadTokens = () =>
  prices().then((pd): TokenPrice[] =>
    TOKENS.map((t) => {
      const v = usdE6(pd, t.id, (BigInt(10) ** BigInt(t.decimals)).toString());
      return { ...t, logo: LOGOS[t.symbol], price: v === null ? null : usdNum(v) };
    }),
  );

export type PaktInfo = {
  name: string; vault: string; joinMode: JoinMode; trader: Trader | null; members: number;
  /** usd; null if a held token has no fresh price */
  value: number | null;
  state: VaultState; prices: PriceData;
};
export const loadPakts = () =>
  cached("pakts", async () => {
    const [{ items }, pd] = await Promise.all([pakts({ limit: 100 }), prices()]);
    const rows = await Promise.all(
      items.map(async (r): Promise<PaktInfo | null> => {
        // vault may still be deploying: skip it rather than fail the list
        const s = await getState(r.vault).catch(() => null);
        if (!s) return null;
        const v = vaultValue(s, pd);
        return {
          name: r.info.name ?? paktName(r.vault), vault: r.vault, joinMode: r.info.join_mode ?? s.join_mode,
          trader: s.trader, members: s.members, value: v === null ? null : usdNum(v), state: s, prices: pd,
        };
      }),
    );
    return rows.filter((r): r is PaktInfo => r !== null);
  });

export type Holding = { pakt: PaktInfo; shares: string; member: boolean; value: number | null };
export const loadHoldings = (account: string) =>
  cached(`holdings:${account}`, async () => {
    const list = await loadPakts();
    const rows = await Promise.all(
      list.map(async (p): Promise<Holding | null> => {
        const h = await getHolder(p.vault, account);
        if (!h || h.shares === "0") return null;
        const v = vaultValue(p.state, p.prices);
        return { pakt: p, shares: h.shares, member: h.member, value: v === null ? null : usdNum(sharesValue(h.shares, p.state, v)) };
      }),
    );
    return rows.filter((r): r is Holding => r !== null);
  });

export type Loaded<T> = { data?: T; error?: Error };
/** runs fn when deps change; null fn = idle. Results of older deps are dropped */
export function useLoad<T>(fn: (() => Promise<T>) | null, deps: unknown[]): Loaded<T> {
  const key = JSON.stringify(deps);
  const [res, setRes] = useState<Loaded<T> & { key?: string }>({});
  useEffect(() => {
    let live = true;
    fn?.().then(
      (data) => live && setRes({ key, data }),
      (error: Error) => live && setRes({ key, error }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller passes deps
  }, [key]);
  return res.key === key ? res : {};
}

// one shared 30s clock; 0 while prerendering so the build never reads the time
let clock = 0;
const subscribe = (cb: () => void) => {
  const t = setInterval(() => ((clock = Date.now()), cb()), 30_000);
  return () => clearInterval(t);
};
const read = () => (clock ||= Date.now());

/** Date.now that ticks every 30s, for "ago" labels */
export const useNow = () => useSyncExternalStore(subscribe, read, () => 0);

const STAR_KEY = "pakt:starred";
/** starred pakt names in localStorage, synced across components */
export function useStarred() {
  const [starred, set] = useState<string[]>([]);
  useEffect(() => {
    const read = () => {
      try {
        set(JSON.parse(localStorage.getItem(STAR_KEY) ?? "[]"));
      } catch {
        set([]);
      }
    };
    read();
    window.addEventListener("pakt:starred", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("pakt:starred", read);
      window.removeEventListener("storage", read);
    };
  }, []);
  const toggle = (name: string) => {
    const next = starred.includes(name) ? starred.filter((x) => x !== name) : [...starred, name];
    set(next);
    try {
      localStorage.setItem(STAR_KEY, JSON.stringify(next));
    } catch {
      // storage blocked: keep in memory only
    }
    window.dispatchEvent(new Event("pakt:starred"));
  };
  return { starred, toggle };
}

/** wallet tUSDC cash and Σ pakt holdings, usd; undefined while loading or logged out */
export function useTotal(account: string | null) {
  const cash = useLoad(account ? () => ftBalanceOf(BASE_TOKEN.id, account).then((r) => Number(r) / 10 ** BASE_TOKEN.decimals) : null, [account]);
  const held = useLoad(account ? () => loadHoldings(account) : null, [account]);
  return {
    cash: cash.data,
    holdings: held.data,
    inPakts: held.data?.reduce((a, h) => a + (h.value ?? 0), 0),
  };
}

/** "1.5 tBTC" from a raw amount; unknown tokens show the raw string */
export function tokenAmount(id: string, raw: string) {
  const t = token(id);
  if (!t) return `${raw} ${id}`;
  const n = Number(raw) / 10 ** t.decimals;
  return `${n.toLocaleString("en-US", { maximumSignificantDigits: 4 })} ${t.symbol}`;
}
