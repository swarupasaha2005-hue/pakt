"use client";

import { Suspense, useState, useSyncExternalStore } from "react";
import { DepositModal, WALLET } from "@/components/modals/DepositModal";
import { EditProfileModal } from "@/components/modals/EditProfileModal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { useMockSession } from "@/components/session/MockSessionProvider";
import { me } from "@/lib/mock/me";
import type { Holding } from "@/lib/mock/holdings";
import type { Profile } from "@/lib/mock/profiles";
import type { FeedEvent, Pakt } from "@/lib/mock/types";
import { finishOnboarding, getProfile, hasFinishedOnboarding, saveProfile, subscribeOnboarding, subscribeProfile } from "@/lib/profile";
import { ActivityCard } from "./ActivityCard";
import { CashCard } from "./CashCard";
import { OnboardModal } from "./OnboardModal";
import { PositionsCard } from "./PositionsCard";
import { ProfileHeader } from "./ProfileHeader";
import { ValueChart } from "./ValueChart";

type Props = {
  profile: Profile;
  holdings: Holding[];
  pakts: Pakt[];
  events: FeedEvent[];
};

export function ProfileView({ profile: initial, holdings, pakts, events }: Props) {
  const profile = useSyncExternalStore(
    subscribeProfile,
    () => getProfile(initial),
    () => initial,
  );
  const onboardingDone = useSyncExternalStore(
    subscribeOnboarding,
    () => hasFinishedOnboarding(initial.account),
    () => false,
  );
  const [editing, setEditing] = useState(false);
  const [depositing, setDepositing] = useState(false);
  const { connected, requestConnect } = useMockSession();
  const isMe = profile.account === me.account;
  const canManage = isMe && connected;

  const finishSetup = (nextProfile?: Profile) => {
    if (nextProfile) saveProfile(nextProfile);
    finishOnboarding(profile.account);
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-y-auto pb-4">
      <ProfileHeader
        profile={profile}
        onEdit={isMe ? () => connected ? setEditing(true) : requestConnect() : undefined}
        editLabel={isMe && !connected ? "Connect to edit profile" : undefined}
      />
      <div className="mt-4 grid grid-cols-2 items-start gap-3">
        <div className="flex flex-col gap-3">
          <ValueChart profile={profile} />
          {canManage && <CashCard cash={me.cash} onDeposit={() => setDepositing(true)} />}
          {isMe && !connected && <Button variant="primary" onClick={requestConnect}>Connect to deposit</Button>}
          <PositionsCard account={profile.account} holdings={holdings} title={isMe ? "Your holdings" : "Positions"} />
        </div>
        {/* why: useSearchParams suspends in prerendered routes */}
        <Suspense fallback={<Skeleton className="h-[101px]" />}>
          <ActivityCard account={profile.account} events={events} pakts={pakts} />
        </Suspense>
      </div>

      {editing && canManage && (
        <EditProfileModal
          profile={profile}
          onClose={() => setEditing(false)}
          onSave={(p) => {
            saveProfile(p);
            setEditing(false);
          }}
        />
      )}
      {canManage && (
        <Suspense>
          <OnboardModal
            profile={profile}
            ready
            done={onboardingDone}
            onSave={finishSetup}
            onSkip={() => finishSetup()}
          />
        </Suspense>
      )}
      {depositing && canManage && (
        <DepositModal
          to={WALLET}
          onClose={() => setDepositing(false)}
          onDeposit={(amount, destination) => {
            if (destination === WALLET) {
              me.cash += amount;
              me.total += amount;
              saveProfile({ ...profile, value: profile.value + amount });
            } else {
              me.cash = Math.max(0, me.cash - amount);
            }
          }}
        />
      )}
    </main>
  );
}
