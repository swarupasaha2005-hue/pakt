import type { ReactNode } from "react";

/** right column slot; pages render it next to their center content */
export function RightPanel({ children }: { children: ReactNode }) {
  return <aside className="w-[316px] shrink-0 overflow-y-auto rounded-2xl border bg-panel">{children}</aside>;
}
