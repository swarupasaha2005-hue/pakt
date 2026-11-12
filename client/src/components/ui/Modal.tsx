"use client";

import { useEffect, type ReactNode } from "react";
import { CloseIcon } from "./icons";

type Props = {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
};

/** centered 412px card, round ✕ floating above its top-right corner */
export function Modal({ open, onClose, label, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label={label}
        className="relative w-[412px] max-w-[calc(100vw-32px)] rounded-2xl border bg-panel p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute -top-12 right-0 flex size-10 items-center justify-center rounded-full border bg-panel text-text hover:bg-panel-2"
        >
          <CloseIcon className="size-5" />
        </button>
        {children}
      </div>
    </div>
  );
}
