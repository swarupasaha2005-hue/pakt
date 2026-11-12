import { Suspense } from "react";
import { DiscoverLink } from "./DiscoverLink";
import { Logo } from "./Logo";
import { Search } from "./Search";
import { SessionActions } from "./SessionActions";

export function TopBar() {
  return (
    <header className="flex min-h-[72px] shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
      <div className="flex items-center gap-6">
        <Logo />
        {/* why: usePathname suspends on unprerendered dynamic routes */}
        <Suspense fallback={<span className="text-base font-medium text-text-2">Discover</span>}>
          <DiscoverLink />
        </Suspense>
      </div>
      <div className="hidden max-w-sm flex-1 lg:block"><Search /></div>
      <SessionActions />
    </header>
  );
}
