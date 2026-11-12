import type { ReactNode } from "react";

/** plain readable page for the footer's legal links */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="min-w-0 flex-1 overflow-y-auto rounded-xl border bg-panel">
      <article className="mx-auto max-w-2xl space-y-4 px-6 py-8 text-sm leading-6 text-text-2 [&_h2]:pt-2 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-text [&_li]:ml-5 [&_li]:list-disc">
        <header>
          <h1 className="text-xl font-bold text-text">{title}</h1>
          <p className="text-xs text-text-3">Last updated {updated}</p>
        </header>
        {children}
      </article>
    </main>
  );
}
