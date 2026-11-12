"use client";

import { useEffect, useRef } from "react";
import { SearchIcon } from "@/components/ui/icons";

export function Search() {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      ref.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const paste = async () => {
    // clipboard can be denied; then just focus so user pastes by hand
    const text = await navigator.clipboard.readText().catch(() => null);
    if (ref.current && text !== null) ref.current.value = text;
    ref.current?.focus();
  };

  return (
    <label className="flex h-12 w-full max-w-[480px] items-center gap-2 rounded-xl border bg-panel pr-2.5 pl-3.5 focus-within:border-text-3">
      <SearchIcon className="size-[18px] text-text-2" />
      <input
        ref={ref}
        type="search"
        placeholder="Search for tokens, pakts or traders…"
        className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-text-2"
      />
      <button type="button" onClick={paste} className="h-[19px] rounded-md bg-panel-2 px-1.5 text-[11px] font-semibold text-text-2 hover:text-text">
        Paste
      </button>
      <kbd className="flex size-[19px] items-center justify-center rounded-md bg-panel-2 font-sans text-[11px] font-semibold text-text-2">
        /
      </kbd>
    </label>
  );
}
