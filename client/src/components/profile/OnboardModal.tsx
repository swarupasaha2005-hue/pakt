"use client";

import { useSearchParams } from "next/navigation";
import { EditProfileModal } from "@/components/modals/EditProfileModal";
import type { Profile } from "@/lib/mock/profiles";

type Props = {
  profile: Profile;
  ready: boolean;
  done: boolean;
  onSave: (profile: Profile) => void;
  onSkip: () => void;
};

export function OnboardModal({ profile, ready, done, onSave, onSkip }: Props) {
  const onboard = useSearchParams().has("onboard");
  if (!ready || !onboard || done) return null;
  return (
    <EditProfileModal
      firstLogin
      profile={profile}
      onSave={onSave}
      onSkip={onSkip}
    />
  );
}
