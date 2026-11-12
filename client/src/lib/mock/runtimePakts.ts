import type { Pakt } from "./types";

type StoredPakt = { pakt: Pakt; inviteToken: string };
const STORAGE_KEY = "pakt:created-pakts";
const CHANGE_EVENT = "pakt:created-pakts-change";
let cachedRaw: string | null | undefined;
let cachedPakts: StoredPakt[] = [];
let cachedPaktList: Pakt[] = [];

function readStoredPakts(): StoredPakt[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) return cachedPakts;
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cachedRaw = raw;
    cachedPakts = Array.isArray(parsed)
      ? parsed.filter((item): item is StoredPakt => {
          if (!item || typeof item !== "object") return false;
          const stored = item as Partial<StoredPakt>;
          return typeof stored.inviteToken === "string"
            && !!stored.pakt
            && typeof stored.pakt.id === "string";
        })
      : [];
    cachedPaktList = cachedPakts.map((item) => item.pakt);
    return cachedPakts;
  } catch {
    return [];
  }
}

export function getCreatedPakt(id: string) {
  return readStoredPakts().find((item) => item.pakt.id === id)?.pakt ?? null;
}

export function getCreatedPakts() {
  readStoredPakts();
  return cachedPaktList;
}

export function hasPaktInvite(id: string, token: string) {
  return readStoredPakts().some((item) => item.pakt.id === id && item.inviteToken === token);
}

export function saveCreatedPakt(pakt: Pakt, inviteToken: string) {
  try {
    const current = readStoredPakts().filter((item) => item.pakt.id !== pakt.id);
    current.push({ pakt, inviteToken });
    const raw = JSON.stringify(current);
    localStorage.setItem(STORAGE_KEY, raw);
    cachedPakts = current;
    cachedPaktList = current.map((item) => item.pakt);
    cachedRaw = raw;
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    return false;
  }
  return true;
}

export function subscribeCreatedPakts(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
