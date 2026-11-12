import { Suspense } from "react";
import { AccountPill } from "./AccountPill";
import { CashPill } from "./CashPill";
import { DiscoverLink } from "./DiscoverLink";
import { HowItWorks } from "./HowItWorks";
import { Logo } from "./Logo";
import { Search } from "./Search";

export function TopBar() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 px-3 md:grid md:h-[68px] md:grid-cols-[1fr_minmax(0,400px)_1fr] md:gap-6 md:px-5">
      <div className="flex items-center gap-6">
        <Logo />
        {/* why: usePathname suspends on unprerendered dynamic routes */}
        <span className="hidden md:contents">
          <Suspense fallback={<span className="text-base font-medium text-text-2">Explore</span>}>
            <DiscoverLink />
          </Suspense>
        </span>
      </div>
      <div className="hidden md:block">
        <Search />
      </div>
      <div className="flex justify-end gap-2">
        <span className="hidden md:contents">
          <HowItWorks />
        </span>
        <CashPill />
        <AccountPill />
      </div>
    </header>
  );
}
