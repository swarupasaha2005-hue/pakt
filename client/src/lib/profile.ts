import type { Profile } from "./mock/profiles";

export const BIO_MAX = 160;
export const FEE_MIN = 10;
export const FEE_MAX = 30;

const profileKey = (account: string) => `pakt:profile:${account}`;
const onboardingKey = (account: string) => `pakt:onboarding:${account}`;
const profileEvent = "pakt:profile-change";
const onboardingEvent = "pakt:onboarding-change";
const profileCache = new Map<string, { raw: string | null; value: Partial<Profile> | null }>();
const resolvedProfileCache = new Map<string, { initial: Profile; saved: Partial<Profile> | null; value: Profile }>();

export function loadProfile(account: string): Partial<Profile> | null {
  try {
    const raw = localStorage.getItem(profileKey(account));
    const cached = profileCache.get(account);
    if (cached?.raw === raw) return cached.value;
    if (!raw) {
      profileCache.set(account, { raw, value: null });
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    const value = parsed && typeof parsed === "object" && !Array.isArray(parsed) && (parsed as Profile).account === account
      ? parsed as Partial<Profile>
      : null;
    profileCache.set(account, { raw, value });
    return value;
  } catch {
    return null;
  }
}

export function getProfile(initial: Profile): Profile {
  const saved = loadProfile(initial.account);
  const cached = resolvedProfileCache.get(initial.account);
  if (cached?.initial === initial && cached.saved === saved) return cached.value;
  const value = saved ? { ...initial, ...saved } : initial;
  resolvedProfileCache.set(initial.account, { initial, saved, value });
  return value;
}

export function subscribeProfile(onChange: () => void) {
  window.addEventListener(profileEvent, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(profileEvent, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function subscribeOnboarding(onChange: () => void) {
  window.addEventListener(onboardingEvent, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(onboardingEvent, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function saveProfile(profile: Profile) {
  try {
    localStorage.setItem(profileKey(profile.account), JSON.stringify(profile));
    profileCache.delete(profile.account);
    resolvedProfileCache.delete(profile.account);
    window.dispatchEvent(new Event(profileEvent));
    return true;
  } catch {
    return false;
  }
}

export function hasFinishedOnboarding(account: string) {
  try {
    return localStorage.getItem(onboardingKey(account)) === "1";
  } catch {
    return false;
  }
}

export function finishOnboarding(account: string) {
  try {
    localStorage.setItem(onboardingKey(account), "1");
    window.dispatchEvent(new Event(onboardingEvent));
    return true;
  } catch {
    return false;
  }
}

export type ProfileForm = {
  name: string;
  avatar: string;
  x: string;
  telegram: string;
  openToHire: boolean;
  /** raw input text */
  fee: string;
};

export const cleanHandle = (s: string) => s.trim().replace(/^@/, "");

// X: 1–15, Telegram: 5–32 chars of [A-Za-z0-9_]
const X_RE = /^\w{1,15}$/;
const TG_RE = /^\w{5,32}$/;

/** field -> message; empty object = valid */
export function profileErrors(f: ProfileForm, firstLogin: boolean) {
  const errors: Partial<Record<keyof ProfileForm, string>> = {};
  if (!f.name.trim()) errors.name = "Display name is required";
  if (firstLogin && !f.avatar) errors.avatar = "Add a photo";
  const x = cleanHandle(f.x);
  if (x && !X_RE.test(x)) errors.x = "Not a valid X handle";
  const tg = cleanHandle(f.telegram);
  if (tg && !TG_RE.test(tg)) errors.telegram = "Not a valid Telegram handle";
  const fee = Number(f.fee);
  if (f.openToHire && (!Number.isInteger(fee) || fee < FEE_MIN || fee > FEE_MAX)) errors.fee = `Whole number, ${FEE_MIN}–${FEE_MAX}%`;
  return errors;
}
