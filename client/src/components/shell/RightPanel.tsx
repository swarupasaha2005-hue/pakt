import type { ReactNode } from "react";

/** right column slot; pages render it next to their center content */
export function RightPanel({ children }: { children: ReactNode }) {
  return <aside className="w-80 shrink-0 overflow-y-auto rounded-xl border bg-panel">{children}</aside>;
}
