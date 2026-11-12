import { Suspense } from "react";
import { AccountPill } from "./AccountPill";
import { CashPill } from "./CashPill";
import { DiscoverLink } from "./DiscoverLink";
import { Logo } from "./Logo";
import { Search } from "./Search";

export function TopBar() {
  return (
    <header className="grid h-16 shrink-0 grid-cols-[1fr_minmax(0,480px)_1fr] items-center gap-6 px-5">
      <div className="flex items-center gap-6">
        <Logo />
        {/* why: usePathname suspends on unprerendered dynamic routes */}
        <Suspense fallback={<span className="text-[17px] font-medium text-text-2">Discover</span>}>
          <DiscoverLink />
        </Suspense>
      </div>
      <Search />
      <div className="flex justify-end gap-2.5">
        <CashPill />
        <AccountPill />
      </div>
    </header>
  );
}
