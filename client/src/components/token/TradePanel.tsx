"use client";

import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { ChevronDownIcon } from "@/components/ui/icons";
import { usd } from "@/lib/format";
import { me } from "@/lib/mock/me";
import { pakts } from "@/lib/mock/pakts";
import { positions } from "@/lib/mock/positions";
import type { Token } from "@/lib/mock/types";
import { MAX_SLIPPAGE, tradeError } from "@/lib/trade";
import { useMockSession } from "@/components/session/MockSessionProvider";

const SLIPPAGES = [0.5, 1, 3, 5];
const CHIPS = [10, 50, 100];
const myPakts = pakts.filter((p) => p.trader === me.account);

const select = "h-7 appearance-none rounded-lg border bg-panel-2 pr-7 pl-2.5 text-xs font-bold text-text";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-text-2">{label}</span>
      <span>{children}</span>
    </div>
  );
}

/** Buy/Sell for Solo or a pakt you trade for; tradeError mirrors the vault rules */
export function TradePanel({ token }: { token: Token }) {
  const { connected, requestConnect } = useMockSession();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [paktId, setPaktId] = useState("");
  const [amount, setAmount] = useState(useSearchParams().get("amount") ?? "");
  const [slippage, setSlippage] = useState(0.5);
  const [sent, setSent] = useState("");

  const pakt = myPakts.find((p) => p.id === paktId) ?? null;
  const usdAmount = Number(amount) || 0;
  const held = positions
    .filter((p) => p.open && p.symbol === token.symbol && p.paktId === (pakt?.id ?? null))
    .reduce((sum, p) => sum + p.amount * token.price, 0);
  const left = pakt ? pakt.budget - pakt.budgetUsed : me.cash;
  const max = Math.floor(Math.min(side === "sell" ? held : left, pakt?.maxPerTrade ?? Infinity));
  const error = tradeError({ side, usd: usdAmount, token, pakt, slippage, cash: me.cash, held });
  const verb = side === "buy" ? "Buy" : "Sell";

  const submit = () => {
    setSent(`Mock order: ${verb.toLowerCase()} ${usd(usdAmount)} of ${token.symbol} for ${pakt?.name ?? "Solo"}`);
    setAmount("");
  };

  return (
    <section className="space-y-3 border-b p-4">
      <div className="grid grid-cols-2 gap-2">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={side === s}
            onClick={() => setSide(s)}
            className={`h-9 rounded-xl text-base font-bold capitalize transition-colors ${
              side !== s ? "bg-panel-2 text-text-2 hover:text-text" : s === "buy" ? "bg-up-bg text-up" : "bg-down/15 text-down"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <label className="flex items-center justify-between text-xs text-text-2">
        Trading for
        <span className="relative">
          <select value={paktId} onChange={(e) => setPaktId(e.target.value)} className={select}>
            <option value="">Solo</option>
            {myPakts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.paused ? " (paused)" : ""}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2" />
        </span>
      </label>

      <label className="flex h-[69px] items-center justify-between rounded-xl bg-panel-2 px-4">
        <span className="flex items-center text-[30px] leading-9 font-medium">
          $
          <input
            inputMode="decimal"
            placeholder="0"
            aria-label="Amount in USD"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            className="w-32 bg-transparent outline-none placeholder:text-text-3"
          />
        </span>
        <span className="flex flex-col items-end text-xs leading-5 whitespace-nowrap text-text-2">
          <span className="text-text">
            {(usdAmount / token.price).toLocaleString("en-US", { maximumSignificantDigits: 5 })} {token.symbol}
          </span>
          Amount
        </span>
      </label>

      <div className="grid grid-cols-4 gap-2">
        {CHIPS.map((c) => (
          <Button key={c} size="sm" className="h-9 text-sm" onClick={() => setAmount(String(c))}>
            ${c}
          </Button>
        ))}
        <Button size="sm" className="h-9 text-sm" disabled={max <= 0} onClick={() => setAmount(String(max))}>
          Max
        </Button>
      </div>

      <div className="space-y-2.5 pt-1">
        {pakt ? (
          <>
            <Row label="Budget left">
              {usd(left)} <span className="text-text-2">/ {usd(pakt.budget)}</span>
            </Row>
            <Row label="Max per trade">{usd(pakt.maxPerTrade)}</Row>
            <Row label="Trader fee">{pakt.fee}% of profit</Row>
          </>
        ) : (
          <Row label="Cash">{usd(me.cash)}</Row>
        )}
        {side === "sell" && <Row label={`${token.symbol} held`}>{usd(held)}</Row>}
        <label className="flex items-center justify-between text-xs text-text-2">
          Slippage
          <span className="relative">
            <select value={slippage} onChange={(e) => setSlippage(Number(e.target.value))} className={select}>
              {SLIPPAGES.map((s) => (
                <option key={s} value={s}>
                  {s}%{s > MAX_SLIPPAGE ? " (over cap)" : ""}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2" />
          </span>
        </label>
      </div>

      {connected ? (
        <Button
          size="lg"
          variant={side === "buy" ? "up" : "secondary"}
          disabled={!!error || !usdAmount}
          onClick={submit}
          className={`w-full ${error ? "disabled:text-down!" : ""}`}
        >
          {error ?? (usdAmount ? `${verb} ${token.symbol}` : "Enter amount")}
        </Button>
      ) : (
        <Button size="lg" variant="primary" onClick={requestConnect} className="w-full">Connect to trade</Button>
      )}
      {sent && <p className="text-center text-xs text-up">{sent}</p>}

      {!token.allowed && (
        <div className="rounded-xl bg-warn-bg p-3">
          <p className="text-sm font-bold text-down">Not on the whitelist</p>
          <p className="text-xs text-text-2">Vaults only trade established tokens, so nobody can drain one into a token they control.</p>
        </div>
      )}
    </section>
  );
}
