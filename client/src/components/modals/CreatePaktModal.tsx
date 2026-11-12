"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Segmented } from "@/components/ui/Segmented";
import { me } from "@/lib/mock/me";

const VISIBILITY = ["Invite only", "Open to join"] as const;
const NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;
const label = "grid grid-cols-[1fr_12rem] items-center gap-3 text-xs text-text-2";

type CreatePakt = { name: string; open: boolean; firstDeposit: number; stopLoss: number };
type Props = { onClose: () => void; onCreate?: (pakt: CreatePakt) => string | false | void };

export function CreatePaktModal({ onClose, onCreate }: Props) {
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<(typeof VISIBILITY)[number]>("Invite only");
  const [firstDeposit, setFirstDeposit] = useState("100");
  const [stopLoss, setStopLoss] = useState("25");
  const [inviteToken, setInviteToken] = useState("");
  const [createError, setCreateError] = useState("");
  const [created, setCreated] = useState(false);
  const [copied, setCopied] = useState(false);
  const depositValue = Number(firstDeposit);
  const invalidName = name.length > 0 && !NAME_RE.test(name);
  const depositError = firstDeposit === "" || !Number.isFinite(depositValue)
    ? "Enter a valid first deposit"
    : depositValue < 5
      ? "First deposit must be at least $5"
      : depositValue > me.cash
        ? `Available balance: $${me.cash.toLocaleString("en-US")}`
        : null;
  const link = `/pakt/${name}?invite=${encodeURIComponent(inviteToken || name)}`;

  if (created) {
    return (
      <Modal open onClose={onClose} label="Invite friends">
        <h2 className="text-xl font-bold">Invite friends</h2>
        <p className="mt-1 text-xs text-text-2">
          {name} is ready in the demo. {visibility === "Open to join" ? "Anyone can join." : "Share this invite link with members."}
        </p>
        <a href={`/pakt/${name}?invite=${encodeURIComponent(inviteToken || name)}`} className="mt-3 flex h-10 items-center justify-center rounded-xl bg-panel-2 text-xs font-bold hover:bg-border">
          Open pakt
        </a>
        <div className="mt-4 flex gap-2">
          <Input readOnly value={link} aria-label="Invite link" onFocus={(e) => e.target.select()} />
          <Button
            onClick={() => navigator.clipboard.writeText(new URL(link, window.location.origin).toString()).then(() => setCopied(true))}
            className="shrink-0"
          >
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <button
          type="button"
          onClick={() => {
            const url = new URL(link, window.location.origin).toString();
            const shareUrl = `https://x.com/intent/post?text=${encodeURIComponent(`Join my pakt ${name} on Pakt`)}&url=${encodeURIComponent(url)}`;
            window.open(shareUrl, "_blank", "noopener,noreferrer");
          }}
          className="mt-3 flex h-10 w-full items-center justify-center rounded-xl bg-panel-2 text-xs font-bold hover:bg-border"
        >
          Share on X
        </button>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} label="Create pakt">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!NAME_RE.test(name) || depositError) return;
          const token = onCreate?.({ name, open: visibility === "Open to join", firstDeposit: depositValue, stopLoss: Number(stopLoss) });
          if (token === false) {
            setCreateError("That pakt name is already taken");
            return;
          }
          setInviteToken(token || name);
          setCreated(true);
        }}
        className="flex flex-col gap-3"
      >
        <h2 className="text-xl font-bold">Create pakt</h2>
        <Avatar name={name || "pakt"} size={80} />
        <Input
          required
          aria-label="Pakt name"
          placeholder="Pakt name"
          value={name}
          aria-invalid={invalidName}
          // lowercase account name
          onChange={(e) => {
            setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
            setCreateError("");
          }}
        />
        {invalidName && <p className="-mt-2 text-xs text-down">Use 1–32 lowercase letters, numbers or dashes.</p>}
        {createError && <p className="-mt-2 text-xs text-down">{createError}</p>}
        {name && <p className="-mt-2 text-xs text-text-3">becomes {name}.sputnikv2.testnet</p>}
        <Input aria-label="Description" placeholder="Description" />
        <div className={label}>
          Join mode <Segmented options={VISIBILITY} value={visibility} onChange={setVisibility} />
        </div>
        <label className={label}>
          Voting
          <select className="h-10 rounded-lg bg-panel-2 px-3 text-xs text-text outline-none focus:ring-1 focus:ring-accent">
            <option>Majority (50%+)</option>
            <option>Two thirds (66%+)</option>
          </select>
        </label>
        <label className={label}>
          Stop-loss %
          <Input type="number" min={5} max={90} required value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} />
        </label>
        <label className={label}>
          Your deposit $
          <Input
            type="number"
            min={5}
            max={me.cash}
            step="0.01"
            value={firstDeposit}
            onChange={(e) => setFirstDeposit(e.target.value)}
            aria-invalid={!!depositError}
            aria-describedby={depositError ? "first-deposit-error" : undefined}
            required
          />
        </label>
        {depositError && <p id="first-deposit-error" className="-mt-2 text-xs text-down">{depositError}</p>}
        <p className="rounded-xl bg-panel-2 p-3 text-xs text-text-2">
          Demo flow. Pakt setup and invite work locally; wallet signing is not connected.
        </p>
        <Button type="submit" variant="primary" size="lg">
          Create pakt
        </Button>
      </form>
    </Modal>
  );
}
