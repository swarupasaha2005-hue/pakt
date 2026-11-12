"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { EditProfileModal } from "@/components/modals/EditProfileModal";
import type { Profile } from "@/lib/mock/profiles";

// shortcut: first login reached via ?onboard=1, real trigger is "no NEAR Social profile" once wired
export function OnboardModal({ profile, onSave }: { profile: Profile; onSave: (p: Profile) => void }) {
  const onboard = useSearchParams().has("onboard");
  const [done, setDone] = useState(false);
  if (!onboard || done) return null;
  return (
    <EditProfileModal
      firstLogin
      profile={profile}
      onSave={(p) => {
        onSave(p);
        setDone(true);
      }}
    />
  );
}
