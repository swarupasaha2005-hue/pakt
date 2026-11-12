"use client";

import { Suspense, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useWallet } from "@/lib/near/wallet";
import { loadProfile, type ProfileData } from "@/lib/profile/load";
import { ActivityCard } from "./ActivityCard";
import { CashCard } from "./CashCard";
import { PositionsCard } from "./PositionsCard";
import { ProfileHeader } from "./ProfileHeader";

/** undefined = loading, null = no such account */
export function ProfileView({ account }: { account: string }) {
  const [data, setData] = useState<ProfileData | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const isMe = useWallet().accountId === account;

  useEffect(() => {
    let dead = false;
    loadProfile(account).then(
      (d) => !dead && setData(d),
      (e: Error) => !dead && setError(e.message),
    );
    return () => {
      dead = true;
    };
  }, [account]);

  if (data === null)
    return (
      <main className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-20 text-center">
        <h1 className="text-xl font-bold">Account not found</h1>
        <p className="text-sm text-text-2">{account} does not exist on chain.</p>
      </main>
    );

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-y-auto pb-4">
      <ProfileHeader account={account} data={data} />
      {error ? (
        <p className="py-6 text-center text-sm text-down">Could not load profile: {error}</p>
      ) : !data ? (
        <div className="mt-4 grid grid-cols-2 items-start gap-3">
          <Skeleton className="h-[200px]" />
          <Skeleton className="h-[200px]" />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 items-start gap-3">
          <div className="flex flex-col gap-3">
            <CashCard cash={data.cash} />
            <PositionsCard positions={data.positions} title={isMe ? "Your holdings" : "Positions"} />
          </div>
          {/* why: useSearchParams suspends in prerendered routes */}
          <Suspense fallback={<Skeleton className="h-[101px]" />}>
            <ActivityCard account={account} data={data} />
          </Suspense>
        </div>
      )}
    </main>
  );
}
