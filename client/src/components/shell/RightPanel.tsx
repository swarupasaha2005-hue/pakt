import type { ReactNode } from "react";

/** right column slot; pages render it next to their center content */
export function RightPanel({ children }: { children: ReactNode }) {
  return <aside className="w-full shrink-0 xl:w-[300px] overflow-y-auto rounded-xl border bg-panel">{children}</aside>;
}
