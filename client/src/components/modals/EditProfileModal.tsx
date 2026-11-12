"use client";

import { useState, type ChangeEvent } from "react";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { Button } from "@/components/ui/Button";
import { LockIcon, PencilIcon, SendIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/Modal";
import { Toggle } from "@/components/ui/Toggle";
import type { Profile } from "@/lib/mock/profiles";
import { BIO_MAX, cleanHandle, FEE_MAX, FEE_MIN, profileErrors } from "@/lib/profile";

type Props = {
  profile: Profile;
  /** "Set up your profile": no ✕, photo + name required */
  firstLogin?: boolean;
  onSave: (profile: Profile) => void;
  onClose?: () => void;
  onSkip?: () => void;
};

const field = "flex flex-col justify-center rounded-xl bg-panel-2 px-3 focus-within:ring-1 focus-within:ring-accent";
const label = "text-xs text-text-2";
const linkRow = "flex h-9 items-center gap-2 rounded-xl bg-panel-2 px-3 text-xs font-bold focus-within:ring-1 focus-within:ring-accent";
const linkInput = "min-w-0 flex-1 bg-transparent outline-none placeholder:text-accent";
const pencil = "flex size-6 items-center justify-center rounded-lg bg-bg/70 text-text";

const fileUrl = (e: ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  return file ? URL.createObjectURL(file) : null;
};

// shortcut: saves to parent state only, NEAR Social write lands with wiring
export function EditProfileModal({ profile, firstLogin = false, onSave, onClose, onSkip }: Props) {
  const [f, setF] = useState({
    name: profile.name,
    bio: profile.bio,
    x: profile.x,
    telegram: profile.telegram,
    avatar: profile.avatar,
    cover: profile.cover,
    openToHire: profile.openToHire,
    fee: String(profile.askingFee),
  });
  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch });
  const errors = profileErrors(f, firstLogin);
  const linkError = errors.x ?? errors.telegram;

  const save = () => {
    const { fee, ...rest } = f;
    onSave({
      ...profile,
      ...rest,
      name: f.name.trim(),
      x: cleanHandle(f.x),
      telegram: cleanHandle(f.telegram),
      askingFee: f.openToHire ? Number(fee) : profile.askingFee,
    });
  };

  return (
    <Modal open onClose={onClose} label={firstLogin ? "Set up your profile" : "Edit profile"}>
      {firstLogin && <h2 className="mb-3 text-xl font-bold">Set up your profile</h2>}
      <div
        className="relative h-[104px] rounded-xl bg-panel-2 bg-cover bg-center"
        style={f.cover ? { backgroundImage: `url(${f.cover})` } : undefined}
      >
        <label className={`absolute right-2 bottom-2 cursor-pointer ${pencil}`}>
          <PencilIcon className="size-3.5" />
          <span className="sr-only">Change cover</span>
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => set({ cover: fileUrl(e) ?? f.cover })} />
        </label>
      </div>
      <div className="relative -mt-[30px] ml-2 flex items-end gap-3">
        <label className="relative cursor-pointer rounded-full ring-4 ring-panel">
          <ProfileAvatar account={profile.account} src={f.avatar} size={60} />
          <span className={`absolute inset-0 m-auto ${pencil}`}>
            <PencilIcon className="size-3.5" />
          </span>
          <span className="sr-only">Change photo</span>
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => set({ avatar: fileUrl(e) ?? f.avatar })} />
        </label>
        {errors.avatar && <span className="pb-1 text-xs text-down">{errors.avatar}</span>}
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        <div className={`${field} h-[62px]`}>
          <span className={label}>Username</span>
          <span className="flex items-center justify-between text-base">
            {profile.account}
            <LockIcon className="size-4 text-text-3" />
            <span className="sr-only">(your NEAR account, read-only)</span>
          </span>
        </div>
        <label className={`${field} h-[62px]`}>
          <span className={label}>Display name</span>
          <input
            value={f.name}
            maxLength={32}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Your name"
            className="bg-transparent text-base outline-none placeholder:text-text-3"
          />
        </label>
        {errors.name && <span className="-mt-1 px-1 text-xs text-down">{errors.name}</span>}
        <div>
          <label className={`${field} h-[82px] justify-start pt-2.5`}>
            <span className={label}>Bio</span>
            <textarea
              value={f.bio}
              maxLength={BIO_MAX}
              onChange={(e) => set({ bio: e.target.value })}
              placeholder="Add a bio"
              className="flex-1 resize-none bg-transparent text-base outline-none placeholder:text-text-2"
            />
          </label>
          <p className="mt-1 text-right text-xs text-text-2">
            {f.bio.length}/{BIO_MAX}
          </p>
        </div>
        <label className={linkRow}>
          <span aria-hidden className="w-4 text-center text-accent">𝕏</span>
          {f.x && <span className="-mr-2">@</span>}
          <input value={f.x} onChange={(e) => set({ x: e.target.value.replace(/^@/, "") })} placeholder="Link X account" aria-label="X handle" className={linkInput} />
        </label>
        <label className={linkRow}>
          <SendIcon className="size-4 text-accent" />
          {f.telegram && <span className="-mr-2">@</span>}
          <input value={f.telegram} onChange={(e) => set({ telegram: e.target.value.replace(/^@/, "") })} placeholder="Link Telegram" aria-label="Telegram handle" className={linkInput} />
        </label>
        <p className={`-mt-1 px-1 text-xs ${linkError ? "text-down" : "text-text-3"}`}>{linkError ?? "Links are self-reported."}</p>
        <div className="rounded-xl bg-panel-2 px-3 py-2.5">
          <div className="flex items-center justify-between text-sm">
            Open to hire
            <Toggle label="Open to hire" checked={f.openToHire} onChange={(openToHire) => set({ openToHire })} />
          </div>
          {f.openToHire && (
            <label className="mt-3 flex flex-col gap-1.5 text-xs text-text-2">
              <span className="flex items-center justify-between">
                Asking fee
                <strong className="text-sm text-text">{f.fee}%</strong>
              </span>
              <input
                type="range"
                min={FEE_MIN}
                max={FEE_MAX}
                step={1}
                value={f.fee}
                onChange={(e) => set({ fee: e.target.value })}
                aria-label="Asking fee"
                aria-invalid={!!errors.fee}
                className="h-2 w-full cursor-pointer accent-accent"
              />
              <span className={errors.fee ? "text-down" : "text-text-3"}>{errors.fee ?? `${FEE_MIN}–${FEE_MAX}% of profit`}</span>
            </label>
          )}
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        {firstLogin && onSkip && (
          <Button onClick={onSkip} className="h-11! flex-1 text-base!">
            Skip
          </Button>
        )}
        <Button variant="primary" disabled={Object.keys(errors).length > 0} onClick={save} className="h-11! flex-1 text-base!">
          Save
        </Button>
      </div>
    </Modal>
  );
}
