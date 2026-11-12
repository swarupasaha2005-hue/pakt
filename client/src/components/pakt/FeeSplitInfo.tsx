"use client";

import { useState } from "react";
import { Dropdown } from "@/components/ui/Dropdown";
import { InfoIcon } from "@/components/ui/icons";
import { usd } from "@/lib/format";
import { feeSplit, PLATFORM_FEE } from "@/lib/fees";

const EXAMPLE = 100;

/** (i) popover: how profit splits between pakter, platform and members, on a $100 example */
export function FeeSplitInfo({ fee, className = "left-0" }: { fee?: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const shown = fee ?? 20;
  const s = feeSplit(EXAMPLE, shown);
  const rows = [
    ["Members", `${100 - shown - PLATFORM_FEE}%`, s.members],
    [fee === undefined ? "Pakter (10-30%, set by vote)" : "Pakter", `${shown}%`, s.trader],
    ["Pakt platform", `${PLATFORM_FEE}%`, s.platform],
  ] as const;
  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      className={`${className} w-72 p-3 text-xs text-text-2`}
      trigger={
        <button type="button" aria-label="How profit is split" aria-expanded={open} onClick={() => setOpen(!open)} className="inline-flex size-5 items-center justify-center rounded-md text-text-3 hover:text-text">
          <InfoIcon className="size-3.5" />
        </button>
      }
    >
      <p className="font-medium text-text">How profit is split</p>
      <p className="mt-0.5">Example: the vault makes {usd(EXAMPLE)} profit{fee === undefined ? `, pakter fee ${shown}%` : ""}.</p>
      <table className="mt-2 w-full tabular-nums">
        <thead>
          <tr className="text-text-3">
            <th className="pb-1 text-left font-normal">Who</th>
            <th className="pb-1 text-right font-normal">Share</th>
            <th className="pb-1 text-right font-normal">Gets</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([who, pct, amt], i) => (
            <tr key={who} className="border-t">
              <td className={`py-1.5 ${i === 0 ? "text-text" : ""}`}>{who}</td>
              <td className="py-1.5 text-right">{pct}</td>
              <td className={`py-1.5 text-right ${i === 0 ? "text-up" : "text-text"}`}>{usd(amt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="mt-2 list-disc space-y-0.5 pl-4 leading-5">
        <li>Fees only on profit above the high-water mark. Flat or loss: nobody is paid.</li>
        <li>Fees are paid as new vault shares, so the pakter never withdraws tokens.</li>
        <li>Members split their part by how many shares they hold.</li>
      </ul>
    </Dropdown>
  );
}
