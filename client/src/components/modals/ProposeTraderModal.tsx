"use client";

import { useEffect, useState } from "react";
import { TxStatus } from "@/components/pakt/TxStatus";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { leaderboard } from "@/lib/api";
import { compact } from "@/lib/format";
import { getFastHire, getTraderRecord, proposeTrader, quickOffer, type TraderRecord } from "@/lib/near/contracts";
import { useWallet } from "@/lib/near/wallet";
import { useTx } from "@/lib/pakt/tx";
import { e6, toRaw } from "@/lib/pakt/units";

type Props = {
  name: string;
  vault: string;
  dao: string;
  /** pakt holders, listed first */
  members: string[];
  /** pakt default stop-loss */
  stopLossBps: number;
  /** prefilled trader, e.g. hired from the leaderboard */
  trader?: string;
  onClose: () => void;
  onDone: () => void;
};

const field = "grid grid-cols-[1fr_10rem] items-center gap-3 text-xs text-text-2";
// NEAR account ids: lowercase labels split by '.', with '-' or '_' inside a label
const ACCOUNT = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

/** member proposal: once approved the dao calls vault.offer_trader, then the trader accepts.
 *  A pakter with a proven record can be fast-hired by one member, no vote */
export function ProposeTraderModal({ name, vault, dao, members, stopLossBps, trader, onClose, onDone }: Props) {
  const [query, setQuery] = useState(trader ?? "");
  const [traders, setTraders] = useState<{ account: string; note: string }[]>([]);
  const [budget, setBudget] = useState("500");
  const [maxPerTrade, setMaxPerTrade] = useState("50");
  const [fee, setFee] = useState("20");
  const [stopLoss, setStopLoss] = useState(String(stopLossBps / 100));
  const tx = useTx(onDone);
  const { accountId } = useWallet();
  const [rules, setRules] = useState<{ min_hires: number; budget_bps: number } | null>(null);
  const [looked, setLooked] = useState<{ account: string; rec: TraderRecord | null } | null>(null);
  const [fast, setFast] = useState(true);

  useEffect(() => {
    getFastHire(vault).then(setRules);
  }, [vault]);

  useEffect(() => {
    leaderboard({ range: "7d", limit: 20 })
      .then((l) => setTraders(l.traders.items.map((t) => ({ account: t.trader, note: `${Number(t.pnl) < 0 ? "-" : "+"}${compact(Math.abs(e6(t.pnl)))} 7D` }))))
      .catch(() => {});
  }, []);

  const list = [...members.map((account) => ({ account, note: "member" })), ...traders.filter((t) => !members.includes(t.account))];
  const account = query.trim().toLowerCase();
  useEffect(() => {
    if (!rules || !ACCOUNT.test(account)) return;
    const t = setTimeout(() => getTraderRecord(account).then((rec) => setLooked({ account, rec })), 300);
    return () => clearTimeout(t);
  }, [account, rules]);
  const rec = looked?.account === account ? looked.rec : null;
  // the vault re-checks all of this on chain
  const proven = !!rules && !!rec && rec.hires >= rules.min_hires && !rec.profit_usd_e6.startsWith("-");
  const quick = proven && fast && !!accountId && members.includes(accountId);
  const b = toRaw(budget, 6);
  const m = toRaw(maxPerTrade, 6);
  const feeN = Number(fee);
  const slN = Number(stopLoss);
  const blocked =
    account.length < 2 || account.length > 64 || !ACCOUNT.test(account)
      ? "Pick or type a pakter account"
      : !b || !m
        ? "Set budget and max per trade"
        : BigInt(m) > BigInt(b)
          ? "Max per trade over budget"
          : !(feeN >= 10 && feeN <= 30)
            ? "Fee must be 10-30%"
            : !(slN >= 1 && slN <= 90)
              ? "Stop-loss must be 1-90%"
              : null;
  const done = !!tx.hash && !tx.error;

  return (
    <Modal open onClose={onClose} label={`Propose pakter for ${name}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (blocked || !b || !m) return;
          const terms = { account, budget: b, maxPerTrade: m, feeBps: Math.round(feeN * 100), stopLossBps: Math.round(slN * 100) };
          tx.run(quick ? quickOffer(vault, terms) : proposeTrader(dao, vault, terms, `hire ${account} at ${feeN}%`));
        }}
        className="flex flex-col gap-3"
      >
        <h2 className="text-xl font-bold">Propose trader for {name}</h2>
        <Input placeholder="Pakter account, e.g. alice.testnet" aria-label="Pakter account" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div role="radiogroup" className="max-h-56 overflow-y-auto">
          {list
            .filter((c) => c.account.includes(account))
            .map((c) => (
              <label key={c.account} className="flex h-14 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-panel-2">
                <Avatar name={c.account} />
                <span className="flex-1 truncate text-xs">
                  {c.account} <span className="text-text-2">· {c.note}</span>
                </span>
                <input type="radio" name="trader" checked={account === c.account} onChange={() => setQuery(c.account)} className="accent-accent" />
              </label>
            ))}
        </div>
        <label className={field}>
          Budget $
          <Input inputMode="decimal" required value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d.]/g, ""))} />
        </label>
        <label className={field}>
          Max per trade $
          <Input inputMode="decimal" required value={maxPerTrade} onChange={(e) => setMaxPerTrade(e.target.value.replace(/[^\d.]/g, ""))} />
        </label>
        <label className={field}>
          Pakter fee % of profit
          <Input type="number" min={10} max={30} required value={fee} onChange={(e) => setFee(e.target.value)} />
        </label>
        <label className={field}>
          Stop-loss %
          <Input type="number" min={1} max={90} required value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} />
        </label>
        {proven && rules && (
          <label className="flex items-start gap-2 rounded-xl border border-accent/40 p-3 text-xs">
            <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} className="mt-0.5 accent-accent" />
            <span>
              <b className="text-text">Fast hire, no vote.</b>{" "}
              <span className="text-text-2">
                {account} has {rec!.hires} hires and no net loss on record, so any member can send the offer. Budget up to {rules.budget_bps / 100}% of the vault. The DAO
                can still replace the offer or fire anytime.
              </span>
            </span>
          </label>
        )}
        {quick ? (
          <p className="rounded-xl bg-panel-2 p-3 text-xs text-text-2">ⓘ Sends the offer right away. No bond.</p>
        ) : (
          <p className="rounded-xl bg-panel-2 p-3 text-xs text-text-2">
            ⓘ Starts a DAO vote (needs 50%+ of members, 1 day). Bond <Badge tone="neutral">0.1 NEAR</Badge>, returned when the vote closes.
          </p>
        )}
        {done ? (
          <Button variant="primary" size="lg" onClick={onClose}>
            Close
          </Button>
        ) : (
          <Button type="submit" variant="primary" size="lg" disabled={!!blocked || tx.pending}>
            {tx.pending ? "Confirming…" : (blocked ?? (quick ? "Send offer" : "Start vote"))}
          </Button>
        )}
        <TxStatus {...tx} done={quick ? "Offer sent" : "Vote started"} />
      </form>
    </Modal>
  );
}
