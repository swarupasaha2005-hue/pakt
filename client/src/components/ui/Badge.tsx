import type { ReactNode } from "react";

const tones = {
  accent: "bg-accent-bg text-accent",
  up: "bg-up-bg text-up",
  down: "bg-down/15 text-down",
  neutral: "bg-panel-2 text-text-2",
};

export function Badge({ tone = "accent", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return (
    <span className={`inline-flex h-[18px] items-center rounded-md px-1.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}
