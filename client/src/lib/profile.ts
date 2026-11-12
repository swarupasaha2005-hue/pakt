export const BIO_MAX = 160;
export const FEE_MIN = 10;
export const FEE_MAX = 30;

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
