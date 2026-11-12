"use client";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { usd } from "@/lib/format";
import { tokens } from "@/lib/mock/tokens";

type Props = {
  name: string;
  /** 0–1 */
  share: number;
  value: number;
  /** your slice of trader + platform fees, 0 below the high-water mark */
  fees: number;
  onClose: () => void;
  onLeave: () => void;
};

const near = tokens.find((t) => t.symbol === "NEAR")!.price;

export function LeavePaktModal({ name, share, value, fees, onClose, onLeave }: Props) {
  const out = value - fees;
  const rows = [
    ["Your share", `${(share * 100).toFixed(1)}%`],
    ["Value", usd(value)],
    ...(fees > 0 ? [["Fees settled first", `-${usd(fees)}`]] : []),
    // shortcut: assumes a 50/50 NEAR/USDC vault, read real holdings once the vault is wired
    ["You receive", `≈ ${Math.floor(out / 2 / near)} NEAR + ${Math.floor(out / 2)} USDC`],
  ];

  return (
    <Modal open onClose={onClose} label={`Leave ${name}?`}>
      <h2 className="text-xl font-semibold">Leave {name}?</h2>
      <dl className="my-4 space-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <dt className="text-text-2">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <Button variant="down-outline" size="lg" className="w-full" onClick={onLeave}>
        Leave pakt
      </Button>
    </Modal>
  );
}
