import type { ReactNode } from "react";

const tones = {
  accent: "bg-accent-bg text-accent",
  up: "bg-up-bg text-up",
  down: "bg-down/20 text-down",
  neutral: "bg-panel-2 text-text-2",
  cyan: "bg-cyan-400/20 text-cyan-400",
};

export function Badge({ tone = "accent", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return (
    <span className={`inline-flex h-[18px] items-center rounded px-1 text-xs font-bold ${tones[tone]}`}>
      {children}
    </span>
  );
}
