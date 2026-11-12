"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { ChevronDownIcon, ChevronRightIcon } from "@/components/ui/icons";
import { pakts } from "@/lib/mock/pakts";
import { PaktCard } from "./PaktCard";

const top = pakts.toSorted((a, b) => b.pnl7d - a.pnl7d).slice(0, 6);

export function PaktGrid() {
  const [open, setOpen] = useState(true);

  return (
    <section className="border-b px-3 pb-3">
      <div className="flex h-10 items-center justify-between">
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex items-center gap-2 text-base">
          Pakts <Badge>New</Badge>
          <ChevronDownIcon className={`size-4 text-text-2 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        <Link href="/" className="flex items-center gap-0.5 text-sm text-text-2 hover:text-text">
          View all <ChevronRightIcon className="size-4" />
        </Link>
      </div>
      {open && (
        <div className="grid grid-cols-2 gap-2">
          {top.map((p, i) => (
            <PaktCard key={p.id} pakt={p} rank={i + 1} />
          ))}
        </div>
      )}
    </section>
  );
}
