"use client";

import { useSyncExternalStore } from "react";
import { PaktView } from "@/components/pakt/PaktView";
import { getCreatedPakt, hasPaktInvite, subscribeCreatedPakts } from "@/lib/mock/runtimePakts";
import type { Pakt } from "@/lib/mock/types";

type Props = { id: string; initial: Pakt | null; inviteToken?: string };

export function PaktRoute({ id, initial, inviteToken = "" }: Props) {
  const created = useSyncExternalStore(subscribeCreatedPakts, () => getCreatedPakt(id), () => null);
  const ready = useSyncExternalStore(subscribeCreatedPakts, () => true, () => false);
  const pakt = created ?? initial;
  if (!ready) return <main className="min-h-64 flex-1 animate-pulse rounded-2xl bg-panel-2" aria-label="Loading pakt" />;

  if (!pakt) {
    return <main className="flex min-w-0 flex-1 items-center justify-center text-sm text-text-2">Pakt not found.</main>;
  }

  return <PaktView key={pakt.id} initial={pakt} hasInvite={!!inviteToken && hasPaktInvite(id, inviteToken)} />;
}
