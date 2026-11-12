"use client";

import "@near-wallet-selector/modal-ui/styles.css";
import type { FinalExecutionOutcome, WalletSelector } from "@near-wallet-selector/core";
import type { WalletSelectorModal } from "@near-wallet-selector/modal-ui";
import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { NETWORK } from "../config";
import type { Tx } from "./contracts";

type Wallet = {
  /** null = signed out, or selector still loading (see ready) */
  accountId: string | null;
  ready: boolean;
  signIn: () => void;
  signOut: () => Promise<void>;
  /** one wallet prompt for all txs, sent in order; redirect wallets (MyNearWallet) resolve [] and come back via callback url */
  signAndSend: (txs: Tx[]) => Promise<FinalExecutionOutcome[]>;
};

const Ctx = createContext<Wallet | null>(null);

type Loaded = { selector: WalletSelector; modal: WalletSelectorModal };

export function WalletProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);

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

  const value: Wallet = {
    accountId,
    ready: loaded !== null,
    signIn: () => loaded?.modal.show(),
    signOut: async () => {
      if (!loaded) return;
      await (await loaded.selector.wallet()).signOut();
    },
    signAndSend: async (txs) => {
      if (!loaded || !accountId) throw new Error("connect a wallet first");
      const w = await loaded.selector.wallet();
      return (await w.signAndSendTransactions({ transactions: txs })) ?? [];
    },
  };
  return <Ctx value={value}>{children}</Ctx>;
}

export function useWallet(): Wallet {
  const w = use(Ctx);
  if (!w) throw new Error("useWallet outside WalletProvider");
  return w;
}
