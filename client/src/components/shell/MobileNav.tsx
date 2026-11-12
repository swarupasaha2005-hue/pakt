"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { TABS } from "@/components/left/LeftPanel";
import { ActivityIcon, HomeIcon, PieIcon, TrophyIcon, UserIcon } from "@/components/ui/icons";
import { useWallet } from "@/lib/near/wallet";

const SHEETS = [
  { id: "leaderboard", label: "Pakters", Icon: TrophyIcon },
  { id: "feed", label: "Feed", Icon: ActivityIcon },
  { id: "positions", label: "Positions", Icon: PieIcon },
] as const;
type Sheet = (typeof SHEETS)[number]["id"];

const item = "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px]";

/** phone-only bottom bar; Pakters / Feed / Positions open the sidebar lists as full-screen sheets */
export function MobileNav() {
  const path = usePathname();
  const { accountId, signIn } = useWallet();
  // opened sheet is tied to the path, so navigating from inside it closes it
  const [open, setOpen] = useState<{ id: Sheet; path: string } | null>(null);
  const sheet = open?.path === path ? open.id : null;
  const setSheet = (id: Sheet | null) => setOpen(id && { id, path });

  const on = (active: boolean) => (active ? "text-accent" : "text-text-2");
  const body = sheet && TABS.find((t) => t.id === sheet)?.body;

  return (
    <>
      {sheet && (
        <div className="fixed inset-x-0 top-14 bottom-16 z-30 flex animate-fade-in flex-col bg-bg md:hidden">
          <h2 className="shrink-0 px-4 pt-2 pb-1 text-lg font-medium">{SHEETS.find((s) => s.id === sheet)?.label}</h2>
          <div className="flex min-h-0 flex-1 flex-col">
            <Suspense>{body}</Suspense>
          </div>
        </div>
      )}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 flex h-16 border-t bg-panel pb-[env(safe-area-inset-bottom)] md:hidden">
        <Link href="/" onClick={() => setSheet(null)} className={`${item} ${on(!sheet && path === "/")}`}>
          <HomeIcon className="size-5" /> Explore
        </Link>
        {SHEETS.map(({ id, label, Icon }) => (
          <button key={id} type="button" onClick={() => setSheet(sheet === id ? null : id)} className={`${item} ${on(sheet === id)}`}>
            <Icon className="size-5" /> {label}
          </button>
        ))}
        {accountId ? (
          <Link href={`/u/${accountId}`} onClick={() => setSheet(null)} className={`${item} ${on(!sheet && path.startsWith("/u/"))}`}>
            <UserIcon className="size-5" /> Me
          </Link>
        ) : (
          <button type="button" onClick={signIn} className={`${item} text-text-2`}>
            <UserIcon className="size-5" /> Connect
          </button>
        )}
      </nav>
    </>
  );
}
