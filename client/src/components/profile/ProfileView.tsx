"use client";

import { Suspense, useState } from "react";
import { DepositModal, WALLET } from "@/components/modals/DepositModal";
import { EditProfileModal } from "@/components/modals/EditProfileModal";
import { Skeleton } from "@/components/ui/Skeleton";
import { me } from "@/lib/mock/me";
import type { Position } from "@/lib/mock/positions";
import type { Profile } from "@/lib/mock/profiles";
import type { FeedEvent, Pakt } from "@/lib/mock/types";
import { ActivityCard } from "./ActivityCard";
import { CashCard } from "./CashCard";
import { OnboardModal } from "./OnboardModal";
import { PositionsCard } from "./PositionsCard";
import { ProfileHeader } from "./ProfileHeader";
import { ValueChart } from "./ValueChart";

type Props = {
  profile: Profile;
  positions: Position[];
  pakts: Pakt[];
  events: FeedEvent[];
};

export function ProfileView({ profile: initial, positions, pakts, events }: Props) {
  const [profile, setProfile] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [depositing, setDepositing] = useState(false);
  const isMe = profile.account === me.account;

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-y-auto pb-4">
      <ProfileHeader profile={profile} onEdit={isMe ? () => setEditing(true) : undefined} />
      <div className="mt-4 grid grid-cols-2 items-start gap-3">
        <div className="flex flex-col gap-3">
          <ValueChart profile={profile} />
          {isMe && <CashCard cash={me.cash} onDeposit={() => setDepositing(true)} />}
          <PositionsCard account={profile.account} positions={positions} title={isMe ? "Your positions" : "Positions"} />
        </div>
        {/* why: useSearchParams suspends in prerendered routes */}
        <Suspense fallback={<Skeleton className="h-[101px]" />}>
          <ActivityCard account={profile.account} events={events} pakts={pakts} />
        </Suspense>
      </div>

      {editing && (
        <EditProfileModal
          profile={profile}
          onClose={() => setEditing(false)}
          onSave={(p) => {
            setProfile(p);
            setEditing(false);
          }}
        />
      )}
      {isMe && (
        <Suspense>
          <OnboardModal profile={profile} onSave={setProfile} />
        </Suspense>
      )}
      {depositing && <DepositModal to={WALLET} onClose={() => setDepositing(false)} />}
    </main>
  );
}
