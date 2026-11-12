"use client";

import "@near-wallet-selector/modal-ui/styles.css";
import type { FinalExecutionOutcome, WalletSelector } from "@near-wallet-selector/core";
import type { WalletSelectorModal } from "@near-wallet-selector/modal-ui";
import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { NETWORK } from "../config";
import { refreshBalances } from "../home/data";
import type { Tx } from "./contracts";
import { freeTxs, NoDelegates, sendSponsored, sponsorable, topup } from "./sponsor";

type Wallet = {
  /** null = signed out, or selector still loading (see ready) */
  accountId: string | null;
  ready: boolean;
  signIn: () => void;
  signOut: () => Promise<void>;
  /** gas-sponsored txs left for this account; 0 once the wallet turned out unable to sign delegates */
  freeTxs: number;
  /** one wallet prompt for all txs, sent in order; redirect wallets (MyNearWallet) resolve [] and come back via callback url.
   * Gas is on us (sponsored) when every tx fits the free count and the wallet signs delegate actions. */
  signAndSend: (txs: Tx[]) => Promise<{ outs: FinalExecutionOutcome[]; sponsored: boolean }>;
};

const Ctx = createContext<Wallet | null>(null);

type Loaded = { selector: WalletSelector; modal: WalletSelectorModal };

export function WalletProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const [noDelegates, setNoDelegates] = useState<string | null>(null); // wallet id that can't sign them

  useEffect(() => {
    let dead = false;
    if (accountId) freeTxs(accountId).then((n) => !dead && setLeft(n));
    return () => {
      dead = true;
    };
  }, [accountId]);

  useEffect(() => {
    let unsub = () => {};
    let dead = false;
    // browser only: wallet modules touch window at import
    (async () => {
      const [{ setupWalletSelector }, { setupModal }, mnw, meteor, here, hot] = await Promise.all([
        import("@near-wallet-selector/core"),
        import("@near-wallet-selector/modal-ui"),
        import("@near-wallet-selector/my-near-wallet"),
        import("@near-wallet-selector/meteor-wallet"),
        import("@near-wallet-selector/here-wallet"),
        import("@near-wallet-selector/hot-wallet"),
      ]);
      const selector = await setupWalletSelector({
        network: NETWORK,
        modules: [mnw.setupMyNearWallet(), meteor.setupMeteorWallet(), here.setupHereWallet(), hot.setupHotWallet()],
      });
      if (dead) return;
      const sub = selector.store.observable.subscribe((s) => setAccountId(s.accounts.find((a) => a.active)?.accountId ?? null));
      unsub = () => sub.unsubscribe();
      setLoaded({ selector, modal: setupModal(selector, {}) });
    })().catch((e) => console.error("wallet selector failed", e));
    return () => {
      dead = true;
      unsub();
    };
  }, []);

  const walletId = loaded?.selector.store.getState().selectedWalletId ?? null;
  const value: Wallet = {
    accountId,
    ready: loaded !== null,
    freeTxs: left,
    signIn: () => loaded?.modal.show(),
    signOut: async () => {
      if (!loaded) return;
      await (await loaded.selector.wallet()).signOut();
    },
    signAndSend: async (txs) => {
      if (!loaded || !accountId) throw new Error("connect a wallet first");
      const w = await loaded.selector.wallet();
      const publicKey = (await w.getAccounts()).find((a) => a.accountId === accountId)?.publicKey;
      let toppedUp = false;
      if (sponsorable(txs, left)) {
        let walletCant = walletId === noDelegates || !publicKey;
        if (!walletCant) {
          try {
            const outs = await sendSponsored(w, accountId, publicKey!, txs);
            refreshBalances();
            return { outs, sponsored: true };
          } catch (e) {
            if (!(e instanceof NoDelegates)) throw e;
            if (e.walletCant) {
              walletCant = true;
              setNoDelegates(walletId);
            }
          }
        }
        // wallet can't sign delegates: an empty account gets its gas money instead, then sends as usual
        if (walletCant) toppedUp = await topup(accountId);
        freeTxs(accountId).then(setLeft);
      }
      const outs = (await w.signAndSendTransactions({ transactions: txs })) ?? [];
      refreshBalances();
      return { outs, sponsored: toppedUp };
    },
  };
  return <Ctx value={value}>{children}</Ctx>;
}

export function useWallet(): Wallet {
  const w = use(Ctx);
  if (!w) throw new Error("useWallet outside WalletProvider");
  return w;
}
