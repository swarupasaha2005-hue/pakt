"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/Skeleton";
import { PaktCard } from "./PaktCard";

/** top pakts by share price change; undefined while loading */
export function PaktGrid({ pakts }: { pakts?: { name: string; change: number }[] }) {
  const [open, setOpen] = useState(true);

  return (
    <section className="border-b px-3 pb-3">
      <div className="flex h-10 items-center justify-between">
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex items-center gap-2 text-sm font-medium">
          Pakts
          <ChevronDownIcon className={`size-4 text-text-2 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        <Link href="/" className="flex items-center gap-0.5 text-xs text-text-2 hover:text-text">
          View all <ChevronRightIcon className="size-4" />
        </Link>
      </div>
      {open && (
        <div className="grid grid-cols-2 gap-2">
          {pakts
            ? pakts.map((p, i) => <PaktCard key={p.name} name={p.name} change={p.change} rank={i + 1} />)
            : [0, 1].map((i) => <Skeleton key={i} className="h-[54px] rounded-lg" />)}
        </div>
      )}
    </section>
  );
}
