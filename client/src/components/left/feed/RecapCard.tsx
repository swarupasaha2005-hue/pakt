"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { CheckIcon, ChevronDownIcon, HeartIcon, PinIcon } from "@/components/ui/icons";
import { ago } from "@/lib/format";
import { recap } from "@/lib/mock/recap";

/** pinned weekly recap from Pakt, collapsible, likeable */
export function RecapCard() {
  const [open, setOpen] = useState(true);
  const [more, setMore] = useState(false);
  const [liked, setLiked] = useState(false);

  return (
    <article className="border-b px-3 py-3">
      <header className="flex items-center gap-2">
        <Avatar name="pakt" size={28} glyph="P" color="var(--accent)" />
        <span className="flex flex-1 items-center gap-1 text-base">
          Pakt <CheckIcon className="size-3.5 rounded-full bg-accent p-0.5 text-white" strokeWidth={3} />
        </span>
        <span className="text-sm text-text-3">{ago(recap.secondsAgo)}</span>
        <span className="flex items-center gap-1 text-sm text-text-2">
          <PinIcon className="size-3.5" /> Pinned
        </span>
        <button type="button" aria-label={open ? "Collapse recap" : "Expand recap"} aria-expanded={open} onClick={() => setOpen(!open)} className="text-text-2 hover:text-text">
          <ChevronDownIcon className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </header>
      {open && (
        <div className="pl-9">
          <div className="mt-2 overflow-hidden rounded-xl border">
            <h3 className="bg-panel-2 px-2 py-1.5 text-sm font-semibold">{recap.title}</h3>
            <div className="px-2 py-2 text-sm leading-4">
              <ul className={more ? "" : "line-clamp-4"}>
                {recap.bullets.map((b) => (
                  <li key={b}>• {b}</li>
                ))}
              </ul>
              <button type="button" onClick={() => setMore(!more)} className="mt-1.5 font-semibold text-text-3 hover:text-text-2">
                {more ? "Show less" : "Show more"}
              </button>
            </div>
          </div>
          <button
            type="button"
            aria-pressed={liked}
            onClick={() => setLiked(!liked)}
            className={`mt-2 flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-sm ${liked ? "text-pink" : "text-text-2 hover:text-text"}`}
          >
            <HeartIcon className="size-4" fill={liked ? "currentColor" : "none"} /> {recap.likes + Number(liked)}
          </button>
        </div>
      )}
    </article>
  );
}
