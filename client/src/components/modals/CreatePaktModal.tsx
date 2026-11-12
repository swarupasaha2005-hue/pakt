"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Segmented } from "@/components/ui/Segmented";

const VISIBILITY = ["Invite only", "Open"] as const;
const label = "grid grid-cols-[1fr_12rem] items-center gap-3 text-sm text-text-2";

export function CreatePaktModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<(typeof VISIBILITY)[number]>("Invite only");
  const [created, setCreated] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = `https://pakt.app/join/${name}`;

  if (created) {
    return (
      <Modal open onClose={onClose} label="Invite friends">
        <h2 className="text-xl font-semibold">Invite friends</h2>
        <p className="mt-1 text-sm text-text-2">{name} is live. Anyone with the link can deposit and join.</p>
        <div className="mt-4 flex gap-2">
          <Input readOnly value={link} aria-label="Invite link" onFocus={(e) => e.target.select()} />
          <Button
            onClick={() => navigator.clipboard.writeText(link).then(() => setCopied(true))}
            className="shrink-0"
          >
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <a
          href={`https://x.com/intent/post?text=${encodeURIComponent(`Join my pakt ${name} on Pakt`)}&url=${encodeURIComponent(link)}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex h-10 items-center justify-center rounded-xl bg-panel-2 text-sm font-semibold hover:bg-border"
        >
          Share on X
        </a>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} label="Create pakt">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setCreated(true);
        }}
        className="flex flex-col gap-3"
      >
        <h2 className="text-xl font-semibold">Create pakt</h2>
        <Avatar name={name || "pakt"} size={80} />
        <Input
          required
          aria-label="Pakt name"
          placeholder="Pakt name"
          value={name}
          // dao account names: lowercase, digits, dashes only
          onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
        />
        {name && <p className="-mt-2 text-xs text-text-3">becomes {name}.sputnikv2.testnet</p>}
        <Input aria-label="Description" placeholder="Description" />
        <div className={label}>
          Visibility <Segmented options={VISIBILITY} value={visibility} onChange={setVisibility} />
        </div>
        <label className={label}>
          Voting
          <select className="h-10 rounded-lg bg-panel-2 px-3 text-sm text-text outline-none focus:ring-1 focus:ring-accent">
            <option>Majority (50%+)</option>
            <option>Two thirds (66%+)</option>
          </select>
        </label>
        <label className={label}>
          Stop-loss %
          <Input type="number" min={5} max={90} defaultValue={25} />
        </label>
        <label className={label}>
          Your deposit $
          <Input type="number" min={1} defaultValue={100} required />
        </label>
        <p className="rounded-xl bg-panel-2 p-3 text-[13px] text-text-2">
          ⓘ Creates a Sputnik DAO + vault. Network cost ≈ 6 NEAR (refundable deposit).
        </p>
        <Button type="submit" variant="primary" size="lg">
          Create pakt
        </Button>
      </form>
    </Modal>
  );
}
