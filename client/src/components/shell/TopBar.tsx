import { Suspense } from "react";
import { AccountPill } from "./AccountPill";
import { CashPill } from "./CashPill";
import { DiscoverLink } from "./DiscoverLink";
import { HowItWorks } from "./HowItWorks";
import { Logo } from "./Logo";
import { Search } from "./Search";

export function TopBar() {
  return (
    <header className="grid h-[68px] shrink-0 grid-cols-[1fr_minmax(0,400px)_1fr] items-center gap-6 px-5">
      <div className="flex items-center gap-6">
        <Logo />
        {/* why: usePathname suspends on unprerendered dynamic routes */}
        <Suspense fallback={<span className="text-base font-medium text-text-2">Explore</span>}>
          <DiscoverLink />
        </Suspense>
      </div>
      <Search />
      <div className="flex justify-end gap-2">
        <HowItWorks />
        <CashPill />
        <AccountPill />
      </div>
    </header>
  );
}
