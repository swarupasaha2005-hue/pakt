import type { InputHTMLAttributes } from "react";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-10 w-full rounded-lg bg-panel-2 px-3 text-sm text-text outline-none placeholder:text-text-3 focus:ring-1 focus:ring-accent ${className}`}
      {...props}
    />
  );
}
