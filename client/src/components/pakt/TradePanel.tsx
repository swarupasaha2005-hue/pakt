"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { ChevronDownIcon } from "@/components/ui/icons";
import { BASE_TOKEN, token } from "@/lib/config";
import { usd } from "@/lib/format";
import { trade, usdE6, type PriceData, type VaultState } from "@/lib/near/contracts";
import { useTx } from "@/lib/pakt/tx";
import { amount, e6, toRaw } from "@/lib/pakt/units";
import { minOut, poolFor, rawFor, tradeError } from "@/lib/trade";
import { TxStatus } from "./TxStatus";
import { WithdrawProof } from "./WithdrawProof";

const SLIPPAGES = [50, 100, 200];
const CHIPS = [5, 10, 25];
const select = "h-7 appearance-none rounded-lg border bg-panel-2 pr-7 pl-2.5 text-xs font-bold text-text";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-text-2">{label}</span>
      <span>{children}</span>
    </div>
  );
}

type Props = { vault: string; state: VaultState; prices: PriceData; account: string; now: number; onDone: () => void };

/** hired trader only: swap vault funds base ↔ token on its ref pool; tradeError mirrors the vault rules */
export function TradePanel({ vault, state, prices, account, now, onDone }: Props) {
  const tokens = state.balances.map(([id]) => id).filter((id) => id !== BASE_TOKEN.id);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [pick, setPick] = useState(tokens[0] ?? "");
  const [input, setInput] = useState("");
  const [slippage, setSlippage] = useState(100);
  const tx = useTx(() => {
    setInput("");
    onDone();
  });

  const t = state.trader!;
  const [tokenIn, tokenOut] = side === "buy" ? [BASE_TOKEN.id, pick] : [pick, BASE_TOKEN.id];
  const wanted = toRaw(input, 6);
  const amountIn = wanted === null ? null : (rawFor(prices, tokenIn, BigInt(wanted))?.toString() ?? null);
  const value = amountIn === null ? null : usdE6(prices, tokenIn, amountIn);
  const out = amountIn === null ? null : minOut(prices, tokenIn, amountIn, tokenOut, slippage);
  const held = state.balances.find(([id]) => id === tokenIn)?.[1] ?? "0";
  const heldUsd = usdE6(prices, tokenIn, held) ?? BigInt(0);
  const room = BigInt(t.budget) - BigInt(t.budget_used);
  const max = [BigInt(t.max_per_trade), room, heldUsd].reduce((a, b) => (b < a ? b : a));
  const error = tradeError({ state, account, tokenIn, tokenOut, amountIn: wanted && (amountIn ?? "0"), value, slippageBps: slippage, now });
  const sym = token(pick)?.symbol ?? pick;
  const verb = side === "buy" ? "Buy" : "Sell";

  const submit = () => {
    if (!amountIn || !out) return;
    tx.run(trade(vault, { poolId: poolFor(tokenIn, tokenOut)!, tokenIn, tokenOut, amountIn, minOut: out }));
  };

  if (!tokens.length) return <section className="border-b p-4 text-xs text-text-2">This pakt only holds {BASE_TOKEN.symbol}: nothing to trade.</section>;
  return (
    <section className="space-y-3 border-b p-4">
      <h2 className="text-xs font-bold tracking-wide text-text-2 uppercase">Trade for the pakt</h2>
      <div className="grid grid-cols-2 gap-2">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={side === s}
            onClick={() => setSide(s)}
            className={`h-9 rounded-xl text-base font-medium capitalize transition-colors ${
              side !== s ? "bg-panel-2 text-text-2 hover:text-text" : s === "buy" ? "bg-up-bg text-up" : "bg-down/15 text-down"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <label className="flex items-center justify-between text-xs text-text-2">
        Token
        <span className="relative">
          <select value={pick} onChange={(e) => setPick(e.target.value)} className={select}>
            {tokens.map((id) => (
              <option key={id} value={id}>
                {token(id)?.symbol ?? id}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2" />
        </span>
      </label>

      <label className="flex h-[69px] items-center justify-between rounded-xl bg-panel-2 px-4">
        <span className="flex items-center text-[28px] leading-9 font-medium">
          $
          <input
            inputMode="decimal"
            placeholder="0"
            aria-label="Amount in USD"
            value={input}
            onChange={(e) => setInput(e.target.value.replace(/[^\d.]/g, ""))}
            className="w-32 bg-transparent outline-none placeholder:text-text-3"
          />
        </span>
        <span className="flex flex-col items-end text-xs leading-5 whitespace-nowrap text-text-2">
          <span className="text-text">{amountIn ? amount(tokenIn, amountIn) : `0 ${token(tokenIn)?.symbol}`}</span>
          You pay
        </span>
      </label>

      <div className="grid grid-cols-4 gap-2">
        {CHIPS.map((c) => (
          <Button key={c} size="sm" className="h-9 text-sm" onClick={() => setInput(String(c))}>
            ${c}
          </Button>
        ))}
        <Button size="sm" className="h-9 text-sm" disabled={max <= BigInt(0)} onClick={() => setInput(String(Math.floor(e6(max) * 100) / 100))}>
          Max
        </Button>
      </div>

      <div className="space-y-2.5 pt-1">
        <Row label="Budget left">
          {usd(e6(room))} <span className="text-text-2">/ {usd(e6(t.budget))}</span>
        </Row>
        <Row label="Max per trade">{usd(e6(t.max_per_trade))}</Row>
        <Row label={`Vault ${token(tokenIn)?.symbol}`}>{amount(tokenIn, held)}</Row>
        <Row label="Min received">{out ? amount(tokenOut, out) : "—"}</Row>
        <label className="flex items-center justify-between text-xs text-text-2">
          Slippage (vault caps at 2%)
          <span className="relative">
            <select value={slippage} onChange={(e) => setSlippage(Number(e.target.value))} className={select}>
              {SLIPPAGES.map((s) => (
                <option key={s} value={s}>
                  {s / 100}%
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2" />
          </span>
        </label>
      </div>

      <Button
        size="lg"
        variant={side === "buy" ? "up" : "secondary"}
        disabled={!!error || !amountIn || !out || tx.pending}
        onClick={submit}
        className={`w-full ${error ? "disabled:text-down!" : ""}`}
      >
        {error ?? (tx.pending ? "Confirming…" : amountIn ? `${verb} ${sym}` : "Enter amount")}
      </Button>
      <TxStatus {...tx} done="Trade sent" />
      <WithdrawProof vault={vault} />
    </section>
  );
}
