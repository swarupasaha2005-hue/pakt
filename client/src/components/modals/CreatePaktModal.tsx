"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FeeSplitInfo } from "@/components/pakt/FeeSplitInfo";
import { InviteByName } from "@/components/pakt/InviteByName";
import { TxStatus } from "@/components/pakt/TxStatus";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { BASE_TOKEN, daoId, TOKENS } from "@/lib/config";
import { createPakt, getPakt, requiredDeposit } from "@/lib/near/contracts";
import { useWallet } from "@/lib/near/wallet";
import { useTx } from "@/lib/pakt/tx";
import { LOGOS } from "@/lib/home/data";
import { fromRaw, toRaw } from "@/lib/pakt/units";

const label = "grid grid-cols-[1fr_12rem] items-center gap-3 text-sm font-medium text-text";
// factory rule: 2-32 of a-z 0-9 - _, and a valid account label (no leading, trailing or double separators)
const NAME = /^[a-z\d]+([-_][a-z\d]+)*$/;

export function CreatePaktModal({ onClose }: { onClose: () => void }) {
  const { accountId, signIn } = useWallet();
  const [name, setName] = useState("");
  const [picked, setPicked] = useState(() => TOKENS.map((t) => t.id));
  const [stopLoss, setStopLoss] = useState("25");
  const [minDeposit, setMinDeposit] = useState("5");
  const [cost, setCost] = useState<string | null>(null);
  const [taken, setTaken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const tx = useTx();
  const whitelist = TOKENS.filter((t) => picked.includes(t.id)).map((t) => t.id);

  useEffect(() => {
    requiredDeposit(whitelist.length).then(setCost).catch(() => setCost(null));
  }, [whitelist.length]);

  useEffect(() => {
    if (!NAME.test(name) || name.length < 2) return;
    const t = setTimeout(() => getPakt(name).then((p) => setTaken(p ? name : null)).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [name]);

  const valid = name.length >= 2 && name.length <= 32 && NAME.test(name);
  const sl = Number(stopLoss);
  const min = toRaw(minDeposit, BASE_TOKEN.decimals);
  const blocked = !valid
    ? "Pick a name"
    : taken === name
      ? "Name taken"
      : !(sl >= 1 && sl <= 90)
        ? "Stop-loss must be 1-90%"
        : !min || Number(minDeposit) < 5
          ? "Min deposit is at least $5"
          : !cost
            ? "Loading cost…"
            : null;

  if (tx.hash && !tx.error) {
    const link = `${window.location.origin}/pakt/${name}`;
    return (
      <Modal open onClose={onClose} label="Invite friends">
        <h2 className="text-xl font-bold">Invite friends</h2>
        <p className="mt-1 text-xs text-text-2">{name} is being set up (DAO, then vault, about a minute). Anyone with the link can deposit and join.</p>
        <div className="mt-4 flex gap-2">
          <Input readOnly value={link} aria-label="Pakt link" onFocus={(e) => e.target.select()} />
          <Button onClick={() => navigator.clipboard.writeText(link).then(() => setCopied(true))} className="shrink-0">
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <a
          href={`https://x.com/intent/post?text=${encodeURIComponent(`Join my pakt ${name} on Pakt`)}&url=${encodeURIComponent(link)}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex h-10 items-center justify-center rounded-xl bg-panel-2 text-xs font-bold hover:bg-border"
        >
          Share on X
        </a>
        <div className="mt-4 border-t pt-4">
          <p className="mb-2 text-sm font-medium">Invite by NEAR account</p>
          <InviteByName pakt={name} />
        </div>
        <Link href={`/pakt/${name}`} onClick={onClose} className="mt-2 flex h-10 items-center justify-center rounded-xl bg-accent text-xs font-bold text-white hover:brightness-110">
          Open pakt and deposit
        </Link>
        <TxStatus {...tx} done="Created" />
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} label="Create pakt">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (blocked || !min || !cost) return;
          tx.run(createPakt({ name, whitelist, stopLossBps: Math.round(sl * 100), joinMode: "Open", minDeposit: min }, cost));
        }}
        className="flex flex-col gap-3"
      >
        <h2 className="flex items-center gap-1.5 text-xl font-bold">
          Create pakt
          <span className="text-base font-normal">
            <FeeSplitInfo />
          </span>
        </h2>
        <Avatar name={name || "pakt"} size={80} />
        <Input
          required
          aria-label="Pakt name"
          placeholder="Pakt name"
          value={name}
          maxLength={32}
          onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
        />
        {name && <p className="-mt-2 text-xs text-text-3">{taken === name ? "name taken" : `becomes ${daoId(name)}`}</p>}
        <div className="flex flex-col gap-2 text-sm font-medium">
          Tokens
          <div className="flex flex-wrap gap-2">
            {TOKENS.map((t) => {
              const on = picked.includes(t.id);
              const base = t.id === BASE_TOKEN.id;
              return (
                <label
                  key={t.id}
                  title={base ? "Deposit token, always on" : undefined}
                  className={`flex h-9 items-center gap-2 rounded-lg border px-2.5 transition-colors has-focus-visible:ring-1 has-focus-visible:ring-accent ${on ? "border-accent bg-accent/10 text-text" : "text-text-2 hover:text-text"} ${base ? "cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={base}
                    onChange={(e) => setPicked((p) => (e.target.checked ? [...p, t.id] : p.filter((x) => x !== t.id)))}
                    className="sr-only"
                  />
                  <Avatar name={t.symbol} src={LOGOS[t.symbol]} size={20} />
                  {t.symbol}
                </label>
              );
            })}
          </div>
        </div>
        <label className={label}>
          Stop-loss %
          <Input type="number" min={1} max={90} value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} />
        </label>
        <label className={label}>
          Min deposit $
          <Input inputMode="decimal" value={minDeposit} onChange={(e) => setMinDeposit(e.target.value.replace(/[^\d.]/g, ""))} />
        </label>
        <p className="rounded-xl bg-panel-2 p-3 text-xs leading-5 text-text-2">
          ⓘ Creates a Sputnik DAO + vault, open to anyone. Network cost{" "}
          <span className="text-text">{cost ? `${fromRaw(cost, 24).toLocaleString("en-US", { maximumFractionDigits: 3 })} NEAR` : "…"}</span>{" "}
          pays their storage and is not refunded. If setup fails, it comes back.
        </p>
        {accountId ? (
          <Button type="submit" variant="primary" size="lg" disabled={!!blocked || tx.pending}>
            {tx.pending ? "Confirming…" : (blocked ?? "Create pakt")}
          </Button>
        ) : (
          <Button variant="primary" size="lg" onClick={signIn}>
            Connect wallet
          </Button>
        )}
        <TxStatus {...tx} />
      </form>
    </Modal>
  );
}
